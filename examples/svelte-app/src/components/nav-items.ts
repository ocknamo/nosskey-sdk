// メインナビゲーションの項目定義。モバイルのフッターメニューと PC のヘッダーナビで
// 同じ並び・アイコンを共有する。ラベルは `$i18n.t.navigation[screen]` で引く。
import AccountIcon from '../assets/account-icon.svg';
import AppsIcon from '../assets/apps-icon.svg';
import KeyIcon from '../assets/key-icon.svg';
import SettingIcon from '../assets/setting-icon.svg';
import type { ScreenName } from '../store/app-state.js';

export type NavScreen = Exclude<ScreenName, 'iframe'>;

export interface NavItem {
  screen: NavScreen;
  icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { screen: 'account', icon: AccountIcon },
  { screen: 'key', icon: KeyIcon },
  { screen: 'apps', icon: AppsIcon },
  { screen: 'settings', icon: SettingIcon },
];
