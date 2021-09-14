import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { BlockBuilder } from '@rocket.chat/apps-engine/definition/uikit';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppEnum } from '../enum/App';
import { ErrorsEnum } from '../enum/Errors';

export const notifyUser = async ({ appId, read, modify, room, user, text, attachments, blocks, threadId }: { appId: string, read: IRead, modify: IModify, room: IRoom, user: IUser, text?: string, attachments?: Array<IMessageAttachment>, blocks?: BlockBuilder, threadId?: string }): Promise<void> => {
    const appUser = await read.getUserReader().getAppUser(appId);
    if (!appUser) {
        throw new Error(ErrorsEnum.ERROR_GETTING_APP_USER);
    }
    const msg = modify.getCreator().startMessage()
        .setGroupable(false)
        .setSender(appUser)
        .setUsernameAlias(AppEnum.USERNAME_ALIAS)
        .setEmojiAvatar(AppEnum.EMOJI_AVATAR)
        .setRoom(room);

    if (threadId !== undefined) {
        msg.setThreadId(threadId);
    }

    if (text && text.length > 0) {
        msg.setText(text);
    }
    if (attachments && attachments.length > 0) {
        msg.setAttachments(attachments);
    }
    if (blocks !== undefined) {
        msg.setBlocks(blocks);
    }

    return read.getNotifier().notifyUser(user, msg.getMessage());
};

export async function sendMessage({ appId, read, modify, room, sender, text, attachments, blocks, threadId }: { appId: string, read: IRead, modify: IModify, room: IRoom, sender?: IUser, text?: string, attachments?: Array<IMessageAttachment>, blocks?: BlockBuilder, threadId?: string }): Promise<void> {
    const appUser = await read.getUserReader().getAppUser(appId);
    if (!appUser) {
        throw new Error(ErrorsEnum.ERROR_GETTING_APP_USER);
    }
    const msg = modify.getCreator().startMessage()
        .setGroupable(false)
        .setSender(sender ? sender : appUser)
        .setRoom(room);

    if (threadId !== undefined) {
        msg.setThreadId(threadId);
    }

    if (text && text.length > 0) {
        msg.setText(text);
    }
    if (attachments && attachments.length > 0) {
        msg.setAttachments(attachments);
    }
    if (blocks !== undefined) {
        msg.setBlocks(blocks);
    }

    await modify.getCreator().finish(msg);
}
