import TelegramBot from 'node-telegram-bot-api';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: true });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Store recent chat history per user
const userHistory: Map<number, string[]> = new Map();

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `🔥 *Welcome to Roast Bot* 🔥\n\n` +
    `I generate personalized roasts based on your chat history.\n\n` +
    `📝 *How to use:*\n` +
    `1. Share some context about yourself or a friend\n` +
    `2. Type /roast to get a personalized roast\n` +
    `3. Type /reset to clear conversation\n` +
    `4. Type /help for more options\n\n` +
    `Let's have fun! 😎`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `🎯 *Roast Bot Commands*\n\n` +
    `/roast - Generate a roast based on context\n` +
    `/reset - Clear conversation history\n` +
    `/help - Show this menu\n` +
    `/savage - Extra brutal roast (higher difficulty)\n` +
    `/lighthearted - Gentle roast (funny, not mean)\n\n` +
    `💡 *Tip:* Share more details about yourself/friends for better roasts!`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  userHistory.delete(chatId);
  bot.sendMessage(chatId, '🗑️ Conversation cleared! Ready for new context.');
});

// Capture all text messages for context
bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const chatId = msg.chat.id;
    if (!userHistory.has(chatId)) {
      userHistory.set(chatId, []);
    }
    userHistory.get(chatId)!.push(msg.text);
    // Keep only last 10 messages for context window
    const history = userHistory.get(chatId)!;
    if (history.length > 10) {
      history.shift();
    }
  }
});

// Roast generation with different intensities
bot.onText(/\/(roast|savage|lighthearted)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const roastType = match![1];

  const history = userHistory.get(chatId) || [];
  if (history.length === 0) {
    bot.sendMessage(
      chatId,
      '📝 Please share some context about yourself or a friend first! ' +
      'Then type /roast for a personalized roast.'
    );
    return;
  }

  // Show typing indicator
  bot.sendChatAction(chatId, 'typing');

  const contextStr = history.join('\n');
  
  let toneInstructions = '';
  switch (roastType) {
    case 'savage':
      toneInstructions = 'Make this HARSH and BRUTAL. Go for the jugular. Maximum savage energy.';
      break;
    case 'lighthearted':
      toneInstructions = 'Keep it FUNNY and PLAYFUL. Make them laugh, not hurt. Gentle roast vibes.';
      break;
    default:
      toneInstructions = 'Make it balanced - funny and cutting without being genuinely mean.';
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content:
            `${toneInstructions}\n\n` +
            `Based on this context about someone, write ONE killer roast (2-3 sentences max). ` +
            `Be creative, witty, and specific to what they've shared.\n\n` +
            `Context:\n${contextStr}\n\n` +
            `Roast:`,
        },
      ],
    });

    const roast = (message.content[0] as { text: string }).text.trim();
    
    // Format with emoji flair
    let emoji = '🔥';
    if (roastType === 'savage') emoji = '💥';
    if (roastType === 'lighthearted') emoji = '😂';

    bot.sendMessage(chatId, `${emoji}\n${roast}\n${emoji}`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Error generating roast:', error);
    bot.sendMessage(
      chatId,
      '⚠️ Roast generator temporarily offline. Try again in a moment!'
    );
  }
});

console.log('🤖 Roast Bot online and ready to roast!');
