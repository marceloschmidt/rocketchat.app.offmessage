// tslint:disable:variable-name
import { OffMessageApp } from '../OffMessageApp';

export class PeopleCache {
    private _employees: Array<any>;
    private _leaves: any;
    private _holidays: any;
    private _birthdays: any;
    private _expire: number;
    private _expirationTime: number = 1800000; // 30 min * 60s * 1000ms

    constructor(private readonly app: OffMessageApp) {}

    public async load(): Promise<any> {
        this.app.getLogger().info('Loading PeopleCache');
        if (this.isValid()) {
            return { employees: this.employees, leaves: this.leaves, holidays: this.holidays, birthdays: this.birthdays };
        }

        this._expire = Date.now() + this._expirationTime;
        const date = new Date();

        const employees = await this.app.zohoPeople.getEmployees();
        const leaves = await this.app.zohoPeople.getLeaves(new Date());
        const _holidays = await this.app.zohoPeople.getHolidays(new Date());

        const holidays: any = {};
        const birthdays: any = { today: {}, month: {} };

        for (const employee of employees) {
            const employeeId = `${ employee.FirstName } ${ employee.LastName } ${ employee.EmployeeID }`

            if (employee['LocationName.ID'] && _holidays[employee['LocationName.ID']]) {
                for (const holiday of _holidays[employee['LocationName.ID']]) {
                    holidays[employeeId] = [].concat(holidays[employeeId] || [], holiday);
                }
            }

            const birthday = new Date(employee.Date_of_birth);
            if (date.getMonth() === birthday.getMonth()) {
                birthdays.month[employeeId] = employee;
                if (date.getDate() === birthday.getDate()) {
                    birthdays.today[employeeId] = employee;
                }
            }
        }

        this.setCache({ employees, leaves, holidays, birthdays });
        this.app.getLogger().info('PeopleCache Loaded');
        this.app.getLogger().info('Employees: ' + JSON.stringify(employees));
        this.app.getLogger().info('Leaves: ' + JSON.stringify(leaves));
        this.app.getLogger().info('Holidays: ' + JSON.stringify(holidays));
        this.app.getLogger().info('Birthdays: ' + JSON.stringify(birthdays));
        return { employees, leaves, holidays, birthdays };
    }

    public async setCache({ employees, leaves, holidays, birthdays }: { employees: Array<any>, leaves: any, holidays: any, birthdays: any }) {
        this._employees = employees;
        this._leaves = leaves;
        this._holidays = holidays;
        this._birthdays = birthdays;
        console.log('OFFMESSAGE', 'PeopleCache set');
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
