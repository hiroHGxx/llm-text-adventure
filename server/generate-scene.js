// 必要なライブラリを読み込み
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Gemini APIの初期化
// Netlifyの環境変数からAPIキーを読み込む
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// これがNetlify Functionsのお作法である「ハンドラー関数」です
exports.handler = async function(event, context) {
  // NetlifyはPOSTリクエストのメソッドを自動で処理するので、ここではHTTPメソッドのチェックはシンプルにします
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    // フロントエンドから送られてくるデータは event.body に文字列として入っています
    const body = JSON.parse(event.body);
    const { prompt, currentScene, history = [] } = body;

    // ストーリー生成のプロンプトテンプレート
    const STORY_PROMPT = `あなたはインタラクティブな物語の語り手です。以下のルールに従って物語を進行させてください：

1. ユーザーの選択に基づいて物語を進めます
2. 各シーンでは、以下のJSON形式で応答してください：
   {
     "text": "シーンの説明文（2-3文）",
     "choices": [
       {"text": "選択肢1（20文字以内）", "nextPrompt": "選択肢1のキーワード"},
       {"text": "選択肢2（20文字以内）", "nextPrompt": "選択肢2のキーワード"}
     ],
     "isEnding": false
   }
3. 物語が終了する場合は、"isEnding": true を設定し、エンディングを表示してください
4. 選択肢は常に2つ生成してください
5. シーンの説明文は100文字以内に収めてください
6. 選択肢のテキストは20文字以内に収めてください

現在の物語の流れ:
{{history}}

次のシーンを生成してください。`;

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: STORY_PROMPT.replace('{{history}}', history.join('\n') || '物語を始めてください') }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSONをパース
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);
    const nextScene = JSON.parse(jsonString);

    // レスポンスを構築
    const responseBody = {
      success: true,
      ...nextScene,
      currentScene: nextScene.isEnding ? 'ending' : `scene_${Date.now()}`
    };

    // 成功した場合、フロントエンドに結果を返す
    return {
      statusCode: 200,
      body: JSON.stringify(responseBody)
    };

  } catch (error) {
    console.error("Function Error:", error); // エラーの詳細はターミナルに出力されます
    // エラーが発生した場合、フロントエンドにエラー情報を返す
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "サーバー内部でエラーが発生しました。" })
    };
  }
};
