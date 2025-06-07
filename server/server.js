const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini APIの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

// ログ出力用のユーティリティ
function log(message, data = '') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
}

// デフォルトのシーンを返す関数
function getDefaultScene() {
  return {
    text: '不思議な森の冒険が始まります...',
    choices: [
      { text: '冒険を始める', nextPrompt: 'start' },
      { text: '森に入る', nextPrompt: 'enter_forest' }
    ],
    isEnding: false
  };
}

// エンディング生成関数
async function generateEnding(history = []) {
  log('Generating ending with history:', { history });
  
  try {
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{
            text: `これまでの物語の展開を踏まえて、この冒険を締めくくる、感動的あるいは示唆に富んだ結末の文章を生成してください。
            
これまでのあらすじ:
${history.join('\n')}

以下のJSON形式で応答してください：
{
  "endingText": "ここに結末の文章を記述してください（200文字程度）"
}`
          }]
        },
      ],
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage('結末を生成してください');
    const response = await result.response;
    const text = response.text();
    
    // JSONをパース
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error generating ending:', error);
    return {
      endingText: 'あなたの冒険は終わりを迎えました。素晴らしい旅でしたね。'
    };
  }
}

// ストーリー生成関数
async function generateStory(prompt, history = []) {
  log('Generating story with prompt:', { prompt, history });
  
  // 環境変数の確認
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    const errorMsg = 'GEMINI_API_KEYが正しく設定されていません。.envファイルを確認してください。';
    log(errorMsg);
    return {
      text: 'システムエラーが発生しました。管理者に連絡してください。',
      choices: [
        { text: 'リロードする', nextPrompt: 'restart' }
      ],
      isEnding: false
    };
  }
  
  try {
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
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error generating story:', error);
    return {
      text: 'エラーが発生しました。もう一度お試しください。',
      choices: [
        { text: '最初からやり直す', nextPrompt: 'restart' }
      ],
      isEnding: false
    };
  }
}

// Expressアプリケーションの設定
const app = express();
const PORT = process.env.PORT || 3001;

// CORS設定
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// プリフライトリクエストの処理
app.options('*', cors());

// リクエストボディのパース
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイルの提供（フロントエンド）
app.use(express.static(path.join(__dirname, '..')));

// フロントエンドのルートにアクセスしたときの処理
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// ヘルスチェック用エンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API情報を返すエンドポイント
app.get('/api', (req, res) => {
  res.json({
    name: 'AIアドベンチャーゲームAPI',
    version: '1.0.0',
    endpoints: [
      { method: 'GET', path: '/health', description: 'ヘルスチェック' },
      { method: 'POST', path: '/api/generate-scene', description: 'シーン生成' }
    ]
  });
});

// シーン生成用のエンドポイント
app.post('/api/generate-scene', async (req, res) => {
  const requestId = Date.now();
  log(`[${requestId}] シーン生成リクエスト受信`);
  
  // リクエストボディの検証
  if (!req.body) {
    const errorMsg = 'リクエストボディが空です';
    log(`[${requestId}] ${errorMsg}`);
    return res.status(400).json({
      success: false,
      error: errorMsg,
      requestId
    });
  }
  
  log(`[${requestId}] リクエストボディ:`, JSON.stringify({
    prompt: req.body.prompt,
    currentScene: req.body.currentScene,
    historyLength: req.body.history ? req.body.history.length : 0
  }, null, 2));
  
  try {
    const { prompt, currentScene, history = [] } = req.body;
    
    // 最初のシーンの場合
    if (!currentScene) {
      const firstScene = await generateStory('物語を始めてください', []);
      return res.json({
        success: true,
        ...firstScene,
        currentScene: 'start'
      });
    }
    
    // リスタートの場合
    if (prompt === 'restart') {
      const firstScene = await generateStory('物語を始めてください', []);
      return res.json({
        success: true,
        ...firstScene,
        currentScene: 'start'
      });
    }
    
    // 次のシーンを生成
    const nextScene = await generateStory(prompt, history);
    
    // レスポンスを構築
    const response = {
      success: true,
      ...nextScene,
      currentScene: nextScene.isEnding ? 'ending' : `scene_${Date.now()}`
    };
    
    console.log(`[${requestId}] シーン生成成功:`, JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error(`[${requestId}] シーン生成エラー:`, error);
    res.status(500).json({
      success: false,
      error: 'シーンの生成中にエラーが発生しました',
      details: error.message
    });
  }
});

// エンディング生成用のエンドポイント
app.post('/api/generate-ending', async (req, res) => {
  const requestId = Date.now();
  log(`[${requestId}] エンディング生成リクエスト受信`);
  
  try {
    const { history = [] } = req.body;
    
    // エンディングを生成
    const ending = await generateEnding(history);
    
    res.json({
      success: true,
      ...ending
    });
    
  } catch (error) {
    console.error(`[${requestId}] Error generating ending:`, error);
    
    res.status(500).json({
      success: false,
      error: 'エンディングの生成中にエラーが発生しました',
      requestId
    });
  }
});

// 404 ハンドラー
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '指定されたエンドポイントは存在しません',
    path: req.path
  });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error('エラーが発生しました:', err);
  res.status(500).json({
    success: false,
    error: '内部サーバーエラーが発生しました',
    message: err.message
  });
});

// サーバー起動
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}`);
});

// グレースフルシャットダウンの処理
function shutdown() {
  console.log('シャットダウンシーケンスを開始します...');
  
  // 新しい接続の受け付けを停止
  server.close(() => {
    console.log('すべての接続がクローズされました');
    process.exit(0);
  });
  
  // 一定時間経過後に強制終了
  setTimeout(() => {
    console.error('強制終了します...');
    process.exit(1);
  }, 5000);
}

// シグナルハンドリング
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
  // 必要に応じてエラーログを記録
});
