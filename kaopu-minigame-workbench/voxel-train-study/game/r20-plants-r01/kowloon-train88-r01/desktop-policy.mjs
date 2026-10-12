import {prepareViewProfiles} from '../view-profile-storage.mjs';
export const DESKTOP_VIEW_KEY='kaopu.train-driver.r20.kowloon-r01.views.v1';
export const DESKTOP_LAYOUT='landscape';
export function prepareDesktopView(raw){const data=prepareViewProfiles(raw);data.layout=DESKTOP_LAYOUT;return data;}
