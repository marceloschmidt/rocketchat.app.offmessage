import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { BlockElementType, IButtonElement, IUIKitResponse, TextObjectType, UIKitBlockInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { AppEnum } from '../enum/App';
import { BlocksEnum } from '../enum/Blocks';
import { notifyUser, sendMessage } from '../lib/message';
import { addTaskPersistence, getUserChoice, persistUserChoice, removeTaskPersistence } from '../lib/persistence';

export class ExecuteBlockActionHandler {
    constructor(
        private readonly app: IApp,
        private readonly read: IRead,
        private readonly modify: IModify,
        private readonly persistence: IPersistence,
    ) {}

    public async run(context: UIKitBlockInteractionContext): Promise<IUIKitResponse> {
        const contextData = context.getInteractionData();
        const actionId = contextData.actionId;
        const { id, text, schedule } = JSON.parse(contextData.value || '{}');

        // Check if user already clicked this message
        const actedMessage = await getUserChoice(this.read.getPersistenceReader(), contextData.user.id, id);
        if (actedMessage) {
            return context.getInteractionResponder().successResponse();
        }

        // Persists click action
        await persistUserChoice(this.persistence, contextData.user.id, id, { clicked: true, timestamp: new Date().getTime() });

        const blocks = this.modify.getCreator().getBlockBuilder();
        switch (actionId) {
            case BlocksEnum.SEND_MESSAGE_ACTION_ID:
                await persistUserChoice(this.persistence, contextData.user.id, contextData.room?.id, { sendMessage: true, timestamp: new Date().getTime() });

                // tslint:disable-next-line:max-line-length
                blocks.addSectionBlock({
                    text: {
                        type: TextObjectType.MARKDOWN,
                        text: BlocksEnum.TIMEOUT_MESSAGE.replace('%s', AppEnum.TIMEOUT_MINUTES),
                    },
                });
                await notifyUser({ appId: this.app.getID(), read: this.read, modify: this.modify, room: contextData.room as IRoom, user: contextData.user, blocks });
                // tslint:disable-next-line:max-line-length
                await sendMessage({ appId: this.app.getID(), read: this.read, modify: this.modify, room: contextData.room as IRoom, sender: contextData.user, text });
                return context.getInteractionResponder().successResponse();
            case BlocksEnum.SCHEDULE_MESSAGE_ACTION_ID:
                const taskId = await this.modify.getScheduler().scheduleOnce({
                    id: 'sendlater',
                    when: schedule,
                    data: { message: text, user: contextData.user, roomId: contextData.room?.id }
                });

                await addTaskPersistence(this.read.getPersistenceReader(), this.persistence, contextData.user.id, { taskId, time: schedule, message: text, roomId: contextData.room?.id, start: new Date() });

                blocks.addSectionBlock({
                    text: {
                        type: TextObjectType.MARKDOWN,
                        text: BlocksEnum.MESSAGE_SCHEDULED.replace('%s', new Date(schedule).toUTCString().replace(/(.*\d\d:\d\d)(:\d\d.*)/, '$1 GMT')),
                    },
                });
                blocks.addActionsBlock({
                    elements: [{
                        type: BlockElementType.BUTTON,
                        text: {
                            type: TextObjectType.PLAINTEXT,
                            text: BlocksEnum.CANCEL_SCHEDULE_LABEL,
                        },
                        value: JSON.stringify({
                            id: taskId
                        }),
                        actionId: BlocksEnum.CANCEL_SCHEDULE_ACTION_ID,
                    } as IButtonElement,
                    ],
                });
                await notifyUser({ appId: this.app.getID(), read: this.read, modify: this.modify, room: contextData.room as IRoom, user: contextData.user, blocks });

                break;
            case BlocksEnum.CANCEL_MESSAGE_ACTION_ID:
                blocks.addSectionBlock({
                    text: {
                        type: TextObjectType.MARKDOWN,
                        text: BlocksEnum.MESSAGE_CANCELLED,
                    },
                });
                await notifyUser({ appId: this.app.getID(), read: this.read, modify: this.modify, room: contextData.room as IRoom, user: contextData.user, blocks });
                break;
            case BlocksEnum.CANCEL_SCHEDULE_ACTION_ID:
                await this.modify.getScheduler().cancelJob(id);
                await removeTaskPersistence(this.read.getPersistenceReader(), this.persistence, contextData.user.id, id);
                blocks.addSectionBlock({
                    text: {
                        type: TextObjectType.MARKDOWN,
                        text: BlocksEnum.MESSAGE_CANCELLED,
                    },
                });
                await notifyUser({ appId: this.app.getID(), read: this.read, modify: this.modify, room: contextData.room as IRoom, user: contextData.user, blocks });
                break;
            default:
                return context.getInteractionResponder().successResponse();
        }

        return context.getInteractionResponder().successResponse();
    }
}
