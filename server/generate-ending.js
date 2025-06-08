// 必要なライブラリを読み込み
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini APIの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Netlify Functions ハンドラー
exports.handler = async function(event, context) {
  // POSTリクエストのみ許可
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    // リクエストボディをパース
    const body = JSON.parse(event.body);
    const { history = [] } = body;

    // エンディング生成のプロンプト
    const ENDING_PROMPT = `あなたは物語の語り手です。これまでの物語の流れに基づいて、感動的なエンディングを生成してください。

これまでの物語の流れ:
${history.join('\n')}

エンディングを生成してください。`;

    // Gemini APIを呼び出してエンディングを生成
    const result = await model.generateContent(ENDING_PROMPT);
    const response = await result.response;
    const endingText = response.text();

    // レスポンスを返す
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        endingText: endingText.trim()
      })
    };

  } catch (error) {
    console.error('Error generating ending:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'エンディングの生成中にエラーが発生しました。',
        details: error.message
      })
    };
  }
};
