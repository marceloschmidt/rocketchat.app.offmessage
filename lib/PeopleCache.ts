// tslint:disable:variable-name
import { OffMessageApp } from '../OffMessageApp';

export class PeopleCache {
    private _employees: Array<any>;
    private _ids: Array<string> = [];
    private _leaves: any;
    private _holidays: any;
    private _birthdays: any;
    private _expire: number;
    private _expirationTime: number = 1800000; // 30 min * 60s * 1000ms

    constructor(private readonly app: OffMessageApp) {}

    public async buildCache(): Promise<any> {
        this._expire = Date.now() + this._expirationTime;
        const date = new Date();

        const employees = await this.app.zohoPeople.getEmployees();
        const leaves = await this.app.zohoPeople.getLeavesByPeriod(new Date());
        const _holidays = await this.app.zohoPeople.getHolidays(new Date());
        const holidays: any = {};
        const birthdays: any = {};

        for (const employee of employees) {
            if (employee['LocationName.ID'] && _holidays[employee['LocationName.ID']]) {
                for (const holiday of _holidays[employee['LocationName.ID']]) {
                    holidays[employee.Zoho_ID] = [].concat(holidays[employee.Zoho_ID] || [], holiday);
                }
            }

            const birthday = new Date(employee.Date_of_birth);
            if (date.getDate() === birthday.getDate() && date.getMonth() === birthday.getMonth()) {
                birthdays[employee.Zoho_ID] = true;
            }
        }

        return { employees, leaves, holidays, birthdays };
    }

    public async setCache({ employees, leaves, holidays, birthdays }: { employees: Array<any>, leaves: any, holidays: any, birthdays: any }) {
        this._employees = employees;
        this._leaves = leaves;
        this._holidays = holidays;
        this._birthdays = birthdays;
        console.log('PeopleCache set');
    }

    public isValid(): boolean {
        return this._expire > Date.now();
    }

    get employees(): Array<any> {
        return this._employees;
    }

    get leaves(): any {
        return this._leaves;
    }

    get holidays(): any {
        return this._holidays;
    }

    get birthdays(): any {
        return this._birthdays;
    }
}
