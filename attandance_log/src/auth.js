import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { config } from './config.js';
import { encryptPassword } from './crypto.js';

function createClient() {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      baseURL: config.baseUrl,
      jar,
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      },
      validateStatus: (status) => status >= 200 && status < 400,
    }),
  );
  return { client, jar };
}

function extractHiddenFields(html) {
  const $ = cheerio.load(html);
  const viewState = $('#__VIEWSTATE').attr('value');
  const viewStateGenerator = $('#__VIEWSTATEGENERATOR').attr('value');
  const loginKey = $('#StaffloginDialog_txtKey').attr('value');

  if (!viewState || !loginKey) {
    throw new Error('Could not find login form fields on the portal home page — its markup may have changed.');
  }
  return { viewState, viewStateGenerator, loginKey };
}

function loginFormStillPresent(html) {
  return html.includes('StaffloginDialog_txt_LoginName');
}

/**
 * Logs into the eSSL/ZKTeco web portal and returns an axios instance whose
 * cookie jar is authenticated, ready to hit pages like AttendenceLog.aspx.
 */
export async function login() {
  const { client } = createClient();

  const homePage = await client.get('/iclock/');
  const { viewState, viewStateGenerator, loginKey } = extractHiddenFields(homePage.data);

  const encryptedPassword = encryptPassword(config.password, loginKey);

  const body = new URLSearchParams({
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGenerator ?? '',
    'StaffloginDialog$txt_LoginName': config.username,
    'StaffloginDialog$Txt_Password': encryptedPassword,
    'StaffloginDialog$txtKey': loginKey,
    'StaffloginDialog$Btn_Ok': 'Login',
  });

  const loginResponse = await client.post('/iclock/', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${config.baseUrl}/iclock/`,
    },
  });

  if (loginFormStillPresent(loginResponse.data)) {
    throw new Error('Login appears to have failed — check ESSL_USERNAME/ESSL_PASSWORD in .env.');
  }

  // Report pages (e.g. AttendenceLog.aspx) render a stub "redirecting..."
  // placeholder instead of real data unless the main dashboard frame has
  // been loaded first in this session.
  await client.get('/iclock/Default.aspx');

  return client;
}
