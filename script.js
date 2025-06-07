// ゲーム状態の管理
const gameState = {
  currentScene: null,
  history: [],
  isProcessing: false,
  turnCount: 0,  // ターンカウンターを追加
  MAX_TURNS: 5  // 最大ターン数を定義
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
    gameState.history.push(sceneData.text);
    
    // 履歴が長すぎる場合は古いものから削除
    if (gameState.history.length > 10) {
      gameState.history.shift();
    }
  }
  
  // エンディングの場合は特別な処理
  if (sceneData.isEnding) {
    showEnding();
  }
}

// エンディング表示
function showEnding() {
  if (!choicesArea) return;
  
  const restartButton = document.createElement('button');
  restartButton.textContent = '最初から始める';
  restartButton.className = 'choice-btn';
  restartButton.addEventListener('click', () => {
    gameState.history = [];
    generateNewScene('restart');
  });
  
  choicesArea.innerHTML = '';
  choicesArea.appendChild(restartButton);
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
    button.addEventListener('click', () => generateNewScene(choice.nextPrompt || choice.text));
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
    
    // 選択肢エリアをクリアして「おしまい」ボタンを表示
    if (choicesArea) {
      choicesArea.innerHTML = '';
      const endButton = document.createElement('button');
      endButton.textContent = '【おしまい】';
      endButton.className = 'choice-btn';
      endButton.onclick = () => {
        gameState.history = [];
        gameState.turnCount = 0;  // ターンカウンターをリセット
        generateNewScene('restart');
      };
      choicesArea.appendChild(endButton);
    }
    
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

// ドキュメントの読み込みが完了したら初期化
document.addEventListener('DOMContentLoaded', init);
