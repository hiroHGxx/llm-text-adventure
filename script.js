// ゲーム状態の管理
const gameState = {
  currentScene: null,
  history: [],  // テキスト履歴（互換性のため保持）
  isProcessing: false,
  turnCount: 0,  // ターンカウンター
  MAX_TURNS: 5,  // 最大ターン数
  storyHistory: []  // プレイ履歴を記録する配列
};

// DOM要素の取得
const sceneElement = document.getElementById('scene');
const choicesArea = document.getElementById('choices-area');
const loadingElement = document.getElementById('loading');

// シーンを表示
function displayScene(sceneData, choices) {
  if (!sceneElement || !choicesArea) return;
  
  // シーンテキストを設定
  sceneElement.textContent = sceneData.text;
  
  // 選択肢を更新
  updateChoices(choices);
  
  // 履歴に追加
  if (sceneData.text) {
    // テキスト履歴（互換性のため保持）
    gameState.history.push(sceneData.text);
    
    // ストーリー履歴に追加
    gameState.storyHistory.push({
      type: 'story',
      text: sceneData.text,
      timestamp: new Date().toISOString()
    });
    
    console.log('Current story history:', gameState.storyHistory);
    
    // 履歴が長すぎる場合は古いものから削除（テキスト履歴のみ）
    if (gameState.history.length > 10) {
      gameState.history.shift();
    }
  }
  
  // エンディングの場合は特別な処理
  if (sceneData.isEnding) {
    // エンディングをストーリー履歴に追加
    gameState.storyHistory.push({
      type: 'ending',
      text: 'エンディングに到達しました',
      timestamp: new Date().toISOString()
    });
    console.log('Ending reached, final story history:', gameState.storyHistory);
    showEnding();
  }
}

// エンディング表示
function showEnding() {
  if (!choicesArea) return;
  
  // 選択肢エリアをクリア
  choicesArea.innerHTML = '';
  
  // ボタンコンテナを作成
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.flexDirection = 'column';
  buttonContainer.style.gap = '10px';
  buttonContainer.style.marginTop = '20px';
  
  // 最初から始めるボタン
  const restartButton = document.createElement('button');
  restartButton.textContent = '最初から始める';
  restartButton.className = 'choice-btn';
  restartButton.addEventListener('click', () => {
    // リセット時に履歴をクリア
    gameState.history = [];
    gameState.storyHistory = [];
    gameState.turnCount = 0;
    
    // 小説生成UIを非表示に
    const novelizationUI = document.getElementById('novelization-ui');
    if (novelizationUI) {
      novelizationUI.style.display = 'none';
    }
    
    // テキストエリアをクリア
    const novelOutput = document.getElementById('novelOutput');
    if (novelOutput) {
      novelOutput.value = '';
    }
    
    // 選択肢エリアをクリア
    if (choicesArea) {
      choicesArea.innerHTML = '';
    }
    
    generateNewScene('restart');
  });
  
  // 小説にするボタン
  const novelizeButton = document.createElement('button');
  novelizeButton.id = 'novelizeButton';
  novelizeButton.textContent = 'この冒険を小説にする';
  novelizeButton.className = 'choice-btn';
  novelizeButton.style.marginTop = '10px';
  novelizeButton.style.cursor = 'pointer';
  
  // ボタンコンテナにボタンを追加
  buttonContainer.appendChild(restartButton);
  buttonContainer.appendChild(novelizeButton);
  
  // 選択肢エリアにボタンコンテナを追加
  choicesArea.appendChild(buttonContainer);
  
  // 小説生成UIを表示
  const novelizationUI = document.getElementById('novelization-ui');
  if (novelizationUI) {
    novelizationUI.style.display = 'block';
  }
  
  // 小説にするボタンがクリックされた時の処理
  novelizeButton.addEventListener('click', () => {
    console.log('小説生成ボタンがクリックされました');
    generateNovel().catch(error => {
      console.error('小説生成中にエラーが発生しました:', error);
    });
  });
  
  // エラーハンドリングを追加
  window.addEventListener('error', (event) => {
    console.error('グローバルエラーが発生しました:', event.error);
  });
}

// 選択肢を更新
function updateChoices(choices) {
  if (!choicesArea) return;
  
  choicesArea.innerHTML = '';
  
  if (!choices || choices.length === 0) {
    const nextButton = document.createElement('button');
    nextButton.textContent = '次へ進む';
    nextButton.className = 'choice-btn';
    nextButton.addEventListener('click', () => generateNewScene('次に何が起こる？'));
    choicesArea.appendChild(nextButton);
    return;
  }
  
  choices.forEach(choice => {
    const button = document.createElement('button');
    button.textContent = choice.text;
    button.className = 'choice-btn';
    button.addEventListener('click', () => {
      // 選択した内容をストーリー履歴に追加
      gameState.storyHistory.push({
        type: 'choice',
        text: choice.text,
        timestamp: new Date().toISOString()
      });
      console.log('Choice made, story history:', gameState.storyHistory);
      generateNewScene(choice.nextPrompt || choice.text);
    });
    choicesArea.appendChild(button);
  });
}

// エンディングを生成
async function generateEnding() {
  try {
    gameState.isProcessing = true;
    if (loadingElement) loadingElement.style.display = 'block';
    
    console.log('Sending request to generate ending with history:', gameState.history);
    const response = await fetch('http://localhost:3001/api/generate-ending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        history: gameState.history
      }),
      credentials: 'include',
      mode: 'cors'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'エンディングの生成に失敗しました');
    }
    
    // エンディングを表示
    if (sceneElement) {
      sceneElement.textContent = data.endingText;
    }
    
    // エンディングをストーリー履歴に追加
    gameState.storyHistory.push({
      type: 'ending',
      text: data.endingText,
      timestamp: new Date().toISOString()
    });
    
    // エンディングUIを表示
    showEnding();
    
  } catch (error) {
    console.error('Error generating ending:', error);
    if (sceneElement) {
      sceneElement.textContent = 'エンディングの生成中にエラーが発生しました。';
    }
    
    // エラー時もリスタートできるようにする
    if (choicesArea) {
      choicesArea.innerHTML = '';
      const restartButton = document.createElement('button');
      restartButton.textContent = '最初からやり直す';
      restartButton.className = 'choice-btn';
      restartButton.onclick = () => {
        gameState.history = [];
        gameState.turnCount = 0;  // ターンカウンターをリセット
        generateNewScene('restart');
      };
      choicesArea.appendChild(restartButton);
    }
  } finally {
    gameState.isProcessing = false;
    if (loadingElement) loadingElement.style.display = 'none';
  }
}

// 新しいシーンを生成
async function generateNewScene(prompt) {
  console.log('generateNewScene called with prompt:', prompt);
  
  if (gameState.isProcessing) {
    console.log('処理中です。しばらくお待ちください...');
    return;
  }
  
  // リスタートまたは初期シーンの場合はターンカウンターをリセット
  if (prompt === 'restart' || !gameState.currentScene) {
    gameState.turnCount = 0;
  } else {
    // ターンカウンターをインクリメント
    gameState.turnCount++;
    
    // 最大ターン数に達したらエンディングを生成
    if (gameState.turnCount >= gameState.MAX_TURNS) {
      await generateEnding();
      return;
    }
  }
  
  try {
    gameState.isProcessing = true;
    if (loadingElement) loadingElement.style.display = 'block';
    
    console.log('Sending request with prompt:', prompt);
    console.log('Current scene:', gameState.currentScene);
    console.log('History:', gameState.history);
    
    const requestBody = {
      prompt,
      currentScene: gameState.currentScene,
      history: gameState.history
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('/api/generate-scene', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      credentials: 'same-origin'
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json().catch(e => {
      console.error('JSON parse error:', e);
      throw new Error('サーバーからの応答を処理できませんでした');
    });
    
    console.log('Response data:', data);
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    if (!data.success) {
      throw new Error(data.error || '不明なエラーが発生しました');
    }
    
    // 現在のシーンを更新
    gameState.currentScene = data.currentScene;
    
    // シーンを表示
    displayScene(data, data.choices || []);
    
  } catch (error) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // エラーメッセージを表示
    const errorMessage = 'エラーが発生しました。もう一度お試しください。';
    
    // エラーを履歴に追加
    gameState.history.push(errorMessage);
    
    // エラーメッセージを表示
    if (sceneElement) {
      sceneElement.textContent = errorMessage;
    }
    
    // リスタートボタンを表示
    const restartButton = document.createElement('button');
    restartButton.textContent = '最初からやり直す';
    restartButton.className = 'choice-btn';
    restartButton.onclick = () => {
      gameState.history = [];
      generateNewScene('restart');
    };
    
    if (choicesArea) {
      choicesArea.innerHTML = '';
      choicesArea.appendChild(restartButton);
    }
    
  } finally {
    gameState.isProcessing = false;
    if (loadingElement) loadingElement.style.display = 'none';
  }
}

// 初期化
function init() {
  // ゲームを開始
  gameState.turnCount = 0;  // ターンカウンターを初期化
  generateNewScene('物語を始めてください');
  
  // リスタートボタンがあればイベントを設定
  const restartButton = document.getElementById('restart-button');
  if (restartButton) {
    restartButton.addEventListener('click', () => {
      gameState.history = [];
      gameState.turnCount = 0;  // ターンカウンターをリセット
      generateNewScene('restart');
    });
  }
}

// 小説を生成する関数
async function generateNovel() {
  console.log('generateNovel関数が呼び出されました');
  
  // 小説にするボタンをIDで取得
  const novelizeButton = document.getElementById('novelizeButton');
  const novelOutput = document.getElementById('novelOutput');
  
  console.log('novelizeButton:', novelizeButton);
  console.log('novelOutput:', novelOutput);
  
  if (!novelizeButton || !novelOutput) {
    const errorMsg = '必要な要素が見つかりません: ' + 
      (!novelizeButton ? 'novelizeButton ' : '') + 
      (!novelOutput ? 'novelOutput' : '');
    console.error(errorMsg);
    alert(errorMsg);
    return;
  }
  
  try {
    console.log('小説生成を開始します...');
    
    // ボタンを無効化し、ローディングメッセージを表示
    novelizeButton.disabled = true;
    novelOutput.value = 'AIが小説を執筆中です...\nしばらくお待ちください...';
    
    // ストーリーログを整形
    console.log('ストーリーログを整形中...');
    const formattedLog = gameState.storyHistory.map(item => {
      if (item.type === 'story') {
        return `場面: ${item.text}`;
      } else if (item.type === 'choice') {
        return `あなたの選択: ${item.text}`;
      } else if (item.type === 'ending') {
        return `エンディング: ${item.text}`;
      }
      return '';
    }).filter(Boolean).join('\n\n');
    
    console.log('フォーマット済みログ:', formattedLog);
    
    // プロンプトを作成
    const prompt = `あなたは優れた小説家です。以下のログは、あるプレイヤーが体験したゲームの記録です。この記録を元に、情景描写や主人公の心情などを豊かに補い、一人称視点の読みやすいショートストーリーとして再構成してください。単なる記録の羅列ではなく、一貫した流れのある物語を執筆してください。

ログ：
${formattedLog}`;

    console.log('APIリクエストを送信します...');
    console.log('プロンプトの長さ:', prompt.length);
    
    const startTime = Date.now();
    const response = await fetch('http://localhost:3001/api/generate-novel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify({ prompt })
    });

    const endTime = Date.now();
    console.log(`APIレスポンス受信 (${endTime - startTime}ms) ステータス:`, response.status);
    
    if (!response.ok) {
      console.error('APIエラーレスポンス:', response);
      let errorData;
      try {
        errorData = await response.json();
        console.error('エラーデータ:', errorData);
      } catch (e) {
        console.error('エラーレスポンスの解析に失敗しました:', e);
        throw new Error(`サーバーエラー: ${response.status} ${response.statusText}`);
      }
      throw new Error(errorData.error || '小説の生成に失敗しました');
    }

    const data = await response.json().catch(e => {
      console.error('JSON解析エラー:', e);
      throw new Error('無効なJSONレスポンスが返されました');
    });
    
    console.log('APIレスポンスデータ:', data);
    
    if (data && data.success && data.novel) {
      console.log('小説の生成に成功しました');
      novelOutput.value = data.novel;
    } else {
      console.error('無効なレスポンス形式:', data);
      throw new Error('小説の生成に失敗しました: 無効なレスポンス形式です');
    }
  } catch (error) {
    console.error('小説生成エラー:', error);
    novelOutput.value = 'エラーが発生しました: ' + error.message;
  } finally {
    novelizeButton.disabled = false;
  }
}

// 小説生成UIを表示する関数
function showNovelizationUI() {
  const novelizationUI = document.getElementById('novelization-ui');
  if (!novelizationUI) return;
  
  // UIを表示
  novelizationUI.style.display = 'block';
  
  // 小説生成ボタンを取得
  const novelizeButton = document.getElementById('novelizeButton');
  if (!novelizeButton) return;
  
  // 既存のイベントリスナーを削除
  const newButton = novelizeButton.cloneNode(true);
  novelizeButton.parentNode.replaceChild(newButton, novelizeButton);
  
  // 新しいイベントリスナーを追加
  newButton.addEventListener('click', generateNovel);
  
  // テキストエリアをクリア
  const novelOutput = document.getElementById('novelOutput');
  if (novelOutput) {
    novelOutput.value = '';
  }
}

// ドキュメントの読み込みが完了したら初期化
document.addEventListener('DOMContentLoaded', () => {
  init();
  
  // 小説生成ボタンにイベントリスナーを追加
  const novelizeButton = document.getElementById('novelizeButton');
  if (novelizeButton) {
    novelizeButton.addEventListener('click', generateNovel);
  }
});
