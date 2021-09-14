import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { BlockElementType, IButtonElement, TextObjectType } from '@rocket.chat/apps-engine/definition/uikit';
import { AppEnum } from '../enum/App';
import { BlocksEnum } from '../enum/Blocks';
import { notifyUser } from '../lib/message';
import { clearUserChoice, getAppStatus, getUserChoice } from '../lib/persistence';
import { OffMessageApp } from '../OffMessageApp';

export class ExecutePreMessageSentPreventHandler {
    constructor(
        private readonly app: OffMessageApp,
        private readonly read: IRead,
        private readonly modify: IModify,
        private readonly persistence: IPersistence,
    ) {}

    public async run(message: IMessage): Promise<boolean> {
        const appStatus = await getAppStatus(this.read.getPersistenceReader(), message.sender.id);
        if (!appStatus?.enabled) {
            return false;
        }

        const date = new Date();
        const destUserId = message.room.userIds?.filter(userId => userId !== message.sender.id)?.[0];

        // Checks if user has clicked to send message anyway in the past TIMEOUT_MINUTES
        const sendAnyway = await getUserChoice(this.read.getPersistenceReader(), message.sender.id, message.room.id);
        if (sendAnyway?.sendMessage) {
            // If time since clicked > TIMEOUT_MINUTES, clear user choice for the room and check if we need to prevent message or not
            if ((date.getTime() - sendAnyway.timestamp) / (1000 * 60) > parseInt(AppEnum.TIMEOUT_MINUTES, 10)) {
                await clearUserChoice(this.persistence, message.sender.id, message.room.id);
            } else {
                return false;
            }
        }

        if (destUserId) {
            const destUser = await this.read.getUserReader().getById(destUserId);
            if (destUser?.emails?.[0]?.address) {
                const email = destUser.emails[0].address;
                if (this.app.peopleCache) {
                    const employees = this.app.peopleCache.employees;
                    const leaves = this.app.peopleCache.leaves;
                    const holidays = this.app.peopleCache.holidays;
                    const birthdays = this.app.peopleCache.birthdays;

                    if (!this.app.peopleCache.isValid()) {
                        this.app.peopleCache.buildCache().then((peopleCache: any) => { this.app.peopleCache.setCache(peopleCache); }).catch((error) => { console.log('Error setting people cache', error) });
                    }

                    let employee;
                    if (employees.length > 0) {
                        for (const person of employees) {
                            if (person.EmailID === email) {
                                employee = person;
                                break;
                            }
                        }
                    }

                    if (employee) {
                        const employeeId = `${ employee.FirstName } ${ employee.LastName } ${ employee.EmployeeID }`

                        // Check if user is on PTO
                        let userOnPTO = '';
                        let userOnPTOSchedule;
                        let tomorrowSchedule = new Date();
                        tomorrowSchedule.setDate(tomorrowSchedule.getDate() + 1);
                        tomorrowSchedule = new Date(Date.UTC(tomorrowSchedule.getFullYear(), tomorrowSchedule.getMonth(), tomorrowSchedule.getDate(), 12, 0, 0));

                        for (const leave of leaves[employeeId] || []) {
                            if ((leave.ApprovalStatus === 'Approved' || leave.ApprovalStatus === 'Pending') && leave.Unit === 'Day') {
                                const from = new Date(leave.From);
                                const to = new Date(leave.To);
                                const toUTC12 = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 12, 0, 0))

                                if (date.getTime() >= from.getTime() && date.getTime() <= to.getTime()) {
                                    userOnPTO = toUTC12.toDateString();
                                    userOnPTOSchedule = toUTC12.toISOString();
                                    break;
                                }
                            }
                        }

                        // Check if user is on a Holiday (auto-PTO)
                        let userOnHoliday = false;
                        for (const holiday of holidays[employee.Zoho_ID] || []) {
                            const holidayDate = new Date(holiday.Date);
                            const holidayDatePlusOne = new Date(holidayDate);
                            holidayDatePlusOne.setDate(holidayDatePlusOne.getDate() + 1);
                            if (date.getTime() >= holidayDate.getTime() && date.getTime() <= holidayDatePlusOne.getTime()) {
                                userOnHoliday = true;
                                break;
                            }
                        }

                        // Check if user is having a birthday (auto-PTO)
                        let userOnBirthday = birthdays[employee.Zoho_ID] || false
                        if (userOnPTO || userOnHoliday || userOnBirthday) {
                            const blocks = this.modify.getCreator().getBlockBuilder();
                            blocks.addSectionBlock({
                                text: {
                                    type: TextObjectType.MARKDOWN,
                                    text: (userOnPTO ? AppEnum.MESSAGE_PREVENTED_PTO.replace('%s', userOnPTO) : ( userOnHoliday ? AppEnum.MESSAGE_PREVENTED_HOLIDAY : AppEnum.MESSAGE_PREVENTED_BIRTHDAY )),
                                },
                            });
                            blocks.addActionsBlock({
                                elements: [{
                                    type: BlockElementType.BUTTON,
                                    text: {
                                        type: TextObjectType.PLAINTEXT,
                                        text: BlocksEnum.SEND_MESSAGE_LABEL,
                                    },
                                    value: JSON.stringify({
                                        id: message.id,
                                        text: message.text,
                                    }),
                                    actionId: BlocksEnum.SEND_MESSAGE_ACTION_ID,
                                } as IButtonElement,
                                {
                                    type: BlockElementType.BUTTON,
                                    text: {
                                        type: TextObjectType.PLAINTEXT,
                                        text: BlocksEnum.SCHEDULE_MESSAGE_LABEL,
                                    },
                                    value: JSON.stringify({
                                        id: message.id,
                                        text: message.text,
                                        schedule: userOnPTOSchedule || tomorrowSchedule
                                    }),
                                    actionId: BlocksEnum.SCHEDULE_MESSAGE_ACTION_ID,
                                } as IButtonElement,
                                {
                                    type: BlockElementType.BUTTON,
                                    text: {
                                        type: TextObjectType.PLAINTEXT,
                                        text: BlocksEnum.CANCEL_MESSAGE_LABEL,
                                    },
                                    value: JSON.stringify({
                                        id: message.id
                                    }),
                                    actionId: BlocksEnum.CANCEL_MESSAGE_ACTION_ID,
                                } as IButtonElement,
                                ],
                            });

                            await notifyUser({ appId: this.app.getID(), read: this.read, modify: this.modify, room: message.room, user: message.sender, blocks });

                            // Prevents sending the message
                            return true;
                        }
                    }
                }
            } else {
                console.log('PeopleCache not loaded');
            }

            // @TODO: Check if user is outside of working hours


            // Check if user is busy or offline
            if (destUser.status === 'busy' || destUser.status === 'offline') {
                const blocks = this.modify.getCreator().getBlockBuilder();
                blocks.addSectionBlock({
                    text: {
                        type: TextObjectType.MARKDOWN,
                        text: AppEnum.MESSAGE_PREVENTED_BUSY_OFFLINE.replace('%s', destUser.status),
                    },
                });
                blocks.addActionsBlock({
                    elements: [{
                        type: BlockElementType.BUTTON,
                        text: {
                            type: TextObjectType.PLAINTEXT,
                            text: BlocksEnum.SEND_MESSAGE_LABEL,
                        },
                        value: JSON.stringify({
                            id: message.id,
                            text: message.text,
                        }),
                        actionId: BlocksEnum.SEND_MESSAGE_ACTION_ID,
                    } as IButtonElement,
                    {
                        type: BlockElementType.BUTTON,
                        text: {
                            type: TextObjectType.PLAINTEXT,
                            text: BlocksEnum.CANCEL_MESSAGE_LABEL,
                        },
                        value: JSON.stringify({
                            id: message.id
                        }),
                        actionId: BlocksEnum.CANCEL_MESSAGE_ACTION_ID,
                    } as IButtonElement,
                    ],
                });

                await notifyUser({ appId: this.app.getID(), read: this.read, modify: this.modify, room: message.room, user: message.sender, blocks });
                return true;
            }
        }

        return false;
    }
}
