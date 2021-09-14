import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { AppEnum } from '../enum/App';
import { CommandsEnum } from '../enum/Commands';
import { ErrorsEnum } from '../enum/Errors';

import { notifyUser } from "../lib/message";
import { persistAppStatus } from '../lib/persistence';
import { OffMessageApp } from '../OffMessageApp';

export class OffMessageCommand implements ISlashCommand {
    public command = CommandsEnum.OFFMESSAGE;
    public i18nParamsExample = 'Params';
    public i18nDescription = 'Description';
    public providesPreview = false;

    constructor(private readonly app: OffMessageApp) { }
    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persistence: IPersistence): Promise<void> {
        try {
            const [command] = context.getArguments();

            switch (command) {
                case CommandsEnum.ENABLE:
                    await persistAppStatus(persistence, context.getSender().id, { enabled: true });
                    await notifyUser({ appId: this.app.getID(), read, modify, room: context.getRoom(), user: context.getSender(), text: AppEnum.APP_ENABLED });
                    break;
                case CommandsEnum.DISABLE:
                    await persistAppStatus(persistence, context.getSender().id, { enabled: false });
                    await notifyUser({ appId: this.app.getID(), read, modify, room: context.getRoom(), user: context.getSender(), text: AppEnum.APP_DISABLED });
                    break;
                default:
                    await notifyUser({ appId: this.app.getID(), read, modify, room: context.getRoom(), user: context.getSender(), text: ErrorsEnum.COMMAND_NOT_FOUND });
                    break;
            }
        } catch (error) {
            const appId = this.app.getID();
            await notifyUser({ appId, read, modify, room: context.getRoom(), user: context.getSender(), text: error.message || ErrorsEnum.OPERATION_FAILED, threadId: context.getThreadId() });
            this.app.getLogger().error(error.message);
        }
    }
}
