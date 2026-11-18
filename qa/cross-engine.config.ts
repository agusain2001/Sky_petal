import {defineConfig,devices} from '@playwright/test';
const desktop={viewport:{width:1440,height:1000}};
export default defineConfig({testDir:'./browser',workers:1,timeout:120000,retries:0,outputDir:process.env.QA_EVIDENCE_DIR+'/browser-results-final',reporter:[['list'],['json',{outputFile:process.env.QA_EVIDENCE_DIR+'/cross-browser.json'}]],use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:4321',launchOptions:{timeout:20000},trace:'off',screenshot:'only-on-failure'},projects:[
{name:'chromium',use:{browserName:'chromium',...desktop}},
{name:'webkit',testIgnore:'**/cms.spec.ts',use:{browserName:'webkit',...desktop}},
{name:'android-chromium',testIgnore:'**/cms.spec.ts',use:{...devices['Pixel 7'],browserName:'chromium'}},
{name:'iphone-webkit',testIgnore:'**/cms.spec.ts',use:{...devices['iPhone 13'],browserName:'webkit'}},
{name:'tablet-chromium',testIgnore:'**/cms.spec.ts',use:{browserName:'chromium',viewport:{width:820,height:1180},hasTouch:true}},
{name:'landscape-chromium',testIgnore:'**/cms.spec.ts',use:{browserName:'chromium',viewport:{width:844,height:390},hasTouch:true,isMobile:true}},
]});
