const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export function loadConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    dataFile: process.env.DATA_FILE || './data/store.json',
    vk: {
      groupId: required('VK_GROUP_ID'),
      confirmationCode: required('VK_CONFIRMATION_CODE'),
      secret: required('VK_CALLBACK_SECRET'),
      token: required('VK_GROUP_TOKEN'),
      apiVersion: process.env.VK_API_VERSION || '5.199',
    },
    uon: {
      apiKey: required('UON_API_KEY'),
      source: process.env.UON_SOURCE || 'ВКонтакте — чат-бот',
      commentField: process.env.UON_COMMENT_FIELD || 'note',
      timeoutMs: Number(process.env.UON_TIMEOUT_MS || 10000),
      retries: Number(process.env.UON_RETRIES || 3),
    },
    email: {
      apiKey: required('RESEND_API_KEY'),
      from: required('NOTIFY_EMAIL_FROM'),
      to: required('NOTIFY_EMAIL_TO').split(',').map((x) => x.trim()).filter(Boolean),
    },
    telegram: {
      botToken: required('TELEGRAM_BOT_TOKEN'),
      chatId: required('TELEGRAM_CHAT_ID'),
    },
  };
}
