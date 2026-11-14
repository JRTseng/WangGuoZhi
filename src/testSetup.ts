import { limits } from './logic/stamina';

// 單元測試預設把體力與每日次數的限制打開：T019 的規則都還在，測試照舊驗證它。
// 「先放開限制」的行為另外在 stamina.test.ts、nextStage.test.ts 裡關掉開關來測。
limits.stamina = true;
limits.dailyRuns = true;
