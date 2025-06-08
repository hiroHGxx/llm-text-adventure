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
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  try {
    // リクエストボディをパース
    const body = JSON.parse(event.body);
    const { prompt } = body;

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'プロンプトが指定されていません' })
      };
    }

    // Gemini APIを呼び出して小説を生成
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const novelText = response.text();

    // レスポンスを返す
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        novel: novelText.trim()
      })
    };

  } catch (error) {
    console.error('小説生成エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: '小説の生成中にエラーが発生しました。',
        details: error.message
      })
    };
  }
};
