import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { SettingEnum } from './enum/Setting';
export const settings: Array<ISetting> = [
    {
        id: SettingEnum.ZOHO_AUTHTOKEN_URL,
        type: SettingType.STRING,
        packageValue: '',
        required: false,
        public: false,
        i18nLabel: SettingEnum.ZOHO_AUTHTOKEN_URL,
        i18nDescription: SettingEnum.ZOHO_AUTHTOKEN_URL_DESCRIPTION,
    },
];
