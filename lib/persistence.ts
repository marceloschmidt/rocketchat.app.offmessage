import { IPersistence, IPersistenceRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

export const persistUserChoice = async (persistence: IPersistence, userId: string, id: string | undefined, data: any): Promise<void> => {
    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, `${ userId }#SEND#${ id }`);
    await persistence.updateByAssociation(association, data, true);
};

export const getUserChoice = async (persistenceRead: IPersistenceRead, userId: string, id: string | undefined): Promise<any> => {
    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, `${ userId }#SEND#${ id }`);
    const result = await persistenceRead.readByAssociation(association) as Array<any>;
    return result && result.length ? result[0] : null;
};

export const clearUserChoice = async (persistence: IPersistence, userId: string, id: string | undefined): Promise<void> => {
    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, `${ userId }#SEND#${ id }`);
    await persistence.removeByAssociation(association);
};

export const setTasksPersistence = async (persistence: IPersistence, userId: string, data: any): Promise<void> => {
    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, `${ userId }#TASKS`);
    await persistence.updateByAssociation(association, data, true);
};

export const getTasksPersistence = async (persistenceRead: IPersistenceRead, userId: string): Promise<any> => {
    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, `${ userId }#TASKS`);
    const result = await persistenceRead.readByAssociation(association) as Array<any>;
    return result && result.length ? result[0] : [];
};

export const addTaskPersistence = async (persistenceRead: IPersistenceRead, persistence: IPersistence, userId: string, task: any): Promise<void> => {
    const data = await getTasksPersistence(persistenceRead, userId);
    data.push(task);
    await setTasksPersistence(persistence, userId, data);
};

export const removeTaskPersistence = async (persistenceRead: IPersistenceRead, persistence: IPersistence, userId: string, taskId?: string): Promise<void> => {
    if (taskId) {
        const data = await getTasksPersistence(persistenceRead, userId);
        const newData = data.filter((task) => task.taskId !== taskId);
        await setTasksPersistence(persistence, userId, newData);
    }
};
