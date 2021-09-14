import { IHttp, IHttpRequest, IHttpResponse, IPersistence, IRead, RequestMethod } from "@rocket.chat/apps-engine/definition/accessors";
import { IApp } from "@rocket.chat/apps-engine/definition/IApp";
import { SettingEnum } from "../enum/Setting";

export class ZohoPeople {
    private token: string = 'Bearer 1007.95c56ed48ade19efa4741a5fc9d0c833.94db96ace2e46ed0e532df183ce5a1d4';

    constructor(
        private readonly app: IApp,
    ) {}

    private async request(method: RequestMethod, path: string, params: any, data: any): Promise<IHttpResponse> {
        if (!this.token) {
            this.token = await this.refreshToken();
        }

		const url = `https://people.zoho.com/people/api/${ path }`;
		const options: IHttpRequest = {
			params,
			data,
			headers: { Authorization: this.token },
		};
        const http = this.app.getAccessors().http;
        const result = await http[method](url, options) as IHttpResponse;
        if (result.statusCode === 401 && result.content?.indexOf('The provided OAuth token is invalid.') !== -1) {
            this.token = await this.refreshToken();
            return this.request(method, path, params, data);
        }
        return result;
    }

    private async refreshToken(): Promise<string> {
        const reader = this.app.getAccessors().reader;
        const http = this.app.getAccessors().http;
        const zohoURL = (await reader.getEnvironmentReader().getSettings().getById(SettingEnum.ZOHO_AUTHTOKEN_URL)).value;
        if (zohoURL) {
            const tokenOutput = await http.get(zohoURL);
            if (tokenOutput?.data?.details?.output) {
                return tokenOutput.data.details.output;
            }
        }
        return "";
    }

    public async getEmployees(sIndex = 0, limit = 200): Promise<any> {
        const employees: any = [];
        let hasMoreRecords = true;
        while (hasMoreRecords) {
            const result = await this.request(RequestMethod.GET, 'forms/employee/getRecords', {
                sIndex,
                limit
            }, {});
            hasMoreRecords = !!result?.data?.response?.result?.length;
            if (hasMoreRecords) {
                for (const record of result.data.response.result) {
                    const employee: any = Object.values(record)?.[0];
                    employees.push(employee?.[0]);
                }
            }
            sIndex += limit;
        }
        return employees;
    }

    public async getLeaves(date: Date, sIndex = 0, limit = 200): Promise<any> {
        date.setDate(date.getDate() + 1);
        const toParts = date.toDateString().split(' ');
        const to = `${ toParts[2] }-${ toParts[1] }-${ toParts[3] }`;
        date.setMonth(date.getMonth() - 1);
        const fromParts = date.toDateString().split(' ');
        const from = `${ fromParts[2] }-${ fromParts[1] }-${ fromParts[3] }`;

        const leaves: any = {};
        let hasMoreRecords = true;
        while (hasMoreRecords) {
            const result = await this.request(RequestMethod.GET, 'forms/leave/getRecords', {
                sIndex,
                limit,
                searchParams: `{searchField:From,searchOperator:Between,searchText:'${ from };${ to }'}`
            }, {});
            hasMoreRecords = !!result?.data?.response?.result?.length;
            if (hasMoreRecords) {
                for (const record of result.data.response.result) {
                    const leave: any = (Object.values(record)?.[0] as any)?.[0];
                    const recordFrom = leave.From.split('-');
                    const recordTo = leave.To.split('-');
                    leave.From = `${ recordFrom[2] }-${ recordFrom[0] }-${ recordFrom[1] }`;
                    leave.To = `${ recordTo[2] }-${ recordTo[0] }-${ recordTo[1] }`;
                    leaves[leave['Employee_ID']] = [].concat(leaves[leave['Employee_ID']] || [], leave);
                }
            }
            sIndex += limit;
        }
        return leaves;
    }

    public async getHolidays(date: Date): Promise<any> {
        const dateString = date.toISOString().split('T')[0];
        const result = await this.request(RequestMethod.GET, 'leave/v2/holidays/get', {
            location: 'ALL',
            from: dateString,
            to: dateString,
            dateFormat: 'yyyy-MM-dd'
        }, {});
        const holidays: any = {};
        for (const holiday of result.data?.data || []) {
            for (const locationId of holiday.LocationId.split(',')) {
                if (locationId) {
                    holidays[locationId] = [].concat(holidays[locationId] || [], holiday);
                }
            }
        }
        return holidays;
    }
}
