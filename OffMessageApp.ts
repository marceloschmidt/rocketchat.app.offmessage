import {
    IAppAccessors,
    IConfigurationExtend,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IMessage, IPostMessageSent, IPreMessageSentPrevent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { StartupType } from '@rocket.chat/apps-engine/definition/scheduler';
import { IUIKitInteractionHandler, IUIKitResponse, UIKitBlockInteractionContext, UIKitViewCloseInteractionContext, UIKitViewSubmitInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { ZohoPeople } from './lib/ZohoPeople';
import { SchedulerEnum } from './enum/SchedulerEnum';
import { ExecuteBlockActionHandler } from './handlers/ExecuteBlockActionHandler';
import { ExecutePostMessageSentHandler } from './handlers/ExecutePostMessageSentHandler';
import { ExecutePreMessageSentPreventHandler } from './handlers/ExecutePreMessagePreventHandler';
import { PeopleCache } from './lib/PeopleCache';
import { sendLaterProcessor } from './processors/SendLaterProcessor';
import { settings } from './settings';
import { OffMessageCommand } from './commands/OffMessageCommand';

export class OffMessageApp extends App implements IUIKitInteractionHandler, IPreMessageSentPrevent, IPostMessageSent {
    public readonly zohoPeople: ZohoPeople;
    public readonly peopleCache: PeopleCache;

    private _modify: IModify;

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
        this.zohoPeople = new ZohoPeople(this);
        this.peopleCache = new PeopleCache(this);
    }

    /*
    Extend Configuration
    Adds commands
    Adds settings
    Sets up the scheduler startup settings and processors
    */
    protected async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        // Settings
        await Promise.all(settings.map((setting) => configuration.settings.provideSetting(setting)));

        // Commands
        await configuration.slashCommands.provideSlashCommand(new OffMessageCommand(this));

        // Scheduler processors:
        configuration.scheduler.registerProcessors([
            {
                id: SchedulerEnum.SETUP,
                startupSetting: {
                    type: StartupType.ONETIME,
                    when: SchedulerEnum.SETUP_TIME
                },
                processor: async (_jobContext, _read, modify) => {
                    this._modify = modify; // HACK to enable preMessagePreventHandler to use IModify
                },
            },
            {
                id: SchedulerEnum.SENDLATER,
                processor: sendLaterProcessor
            }
        ]);
    }

    // When app is enabled, load people cache for the first time
    public async onEnable(): Promise<boolean> {
        await this.peopleCache.load();
        return true;
    }

    /* PreMessage Events */
    // Only runs executePreMessageSentPrevent if people cache has been loaded already and a message is sent on a DM between two people
    public async checkPreMessageSentPrevent(message: IMessage): Promise<boolean> {
        return !!this.peopleCache?.employees && message.room.type === RoomType.DIRECT_MESSAGE && message.room?.userIds?.length === 2;
    }
    // If checkPrevent returns true, executePrevent is run, which then either prevents or doesn't prevent the message
    public async executePreMessageSentPrevent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence): Promise<boolean> {
        try {
            const handler = new ExecutePreMessageSentPreventHandler(this, read, this._modify, persistence);
            return await handler.run(message);
        } catch (err) {
            this.getLogger().log(`${ err.message }`);
            return false;
        }
    }

    /* PostMessage Events */
    // Checks if we should run the postMessageHandler
    public async checkPostMessageSent(message: IMessage): Promise<boolean> {
        // Check if the message is a direct message
        return message.room.type === RoomType.DIRECT_MESSAGE && message.room.userIds?.length === 2;
    }
    // If checkPostMessageSent returns true, executePostMessageSent is run
    public async executePostMessageSent(message: IMessage, read: IRead, _http: IHttp, _persistence: IPersistence, modify: IModify): Promise<void> {
        // HACK to ensure modify is set for the app
        if (!this._modify) {
            this._modify = modify;
        }
        try {
            const handler = new ExecutePostMessageSentHandler(this, read, modify);
            handler.run(message);
        } catch (err) {
            this.getLogger().log(`${ err.message }`);
        }
    }

    /* UIKit Interaction Handlers */
    // UIKit action handler
    // Runs when the user clicks a uikit action button (not close/submit buttons), or changes something on an action block within a modal view
    public async executeBlockActionHandler(context: UIKitBlockInteractionContext, read: IRead, _http: IHttp, persistence: IPersistence, modify: IModify): Promise<IUIKitResponse> {
        try {
            const handler = new ExecuteBlockActionHandler(this, read, modify, persistence);
            return await handler.run(context);
        } catch (err) {
            console.log(err);
            this.getLogger().log(`${ err.message }`);
            return context.getInteractionResponder().errorResponse();
        }
    }
}
