// 전역 변수
let storybooks = [];
let currentStorybook = null;
let imageSettings = {
    aspectRatio: '16:9',
    enforceNoText: true,
    enforceCharacterConsistency: true,
    additionalPrompt: '',
    imageQuality: 'high'
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadImageSettings();
    loadStorybooks();
    renderBookList();
});

// 이미지 설정 관련 함수
function loadImageSettings() {
    const saved = localStorage.getItem('imageSettings');
    if (saved) {
        imageSettings = JSON.parse(saved);
    }
}

function saveImageSettings() {
    localStorage.setItem('imageSettings', JSON.stringify(imageSettings));
}

function openSettings() {
    document.getElementById('imageAspectRatio').value = imageSettings.aspectRatio;
    document.getElementById('enforceNoText').checked = imageSettings.enforceNoText;
    document.getElementById('enforceCharacterConsistency').checked = imageSettings.enforceCharacterConsistency;
    document.getElementById('additionalPrompt').value = imageSettings.additionalPrompt;
    document.getElementById('imageQuality').value = imageSettings.imageQuality;
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings(event) {
    if (!event || event.target.id === 'settingsModal') {
        document.getElementById('settingsModal').classList.add('hidden');
    }
}

function saveSettings() {
    imageSettings.aspectRatio = document.getElementById('imageAspectRatio').value;
    imageSettings.enforceNoText = document.getElementById('enforceNoText').checked;
    imageSettings.enforceCharacterConsistency = document.getElementById('enforceCharacterConsistency').checked;
    imageSettings.additionalPrompt = document.getElementById('additionalPrompt').value;
    imageSettings.imageQuality = document.getElementById('imageQuality').value;
    
    saveImageSettings();
    closeSettings();
    alert('설정이 저장되었습니다!');
}

function resetSettings() {
    if (confirm('모든 설정을 기본값으로 복원하시겠습니까?')) {
        imageSettings = {
            aspectRatio: '16:9',
            enforceNoText: true,
            enforceCharacterConsistency: true,
            additionalPrompt: '',
            imageQuality: 'high'
        };
        saveImageSettings();
        openSettings();
        alert('설정이 기본값으로 복원되었습니다.');
    }
}

// 스토리북 관리
function loadStorybooks() {
    const saved = localStorage.getItem('storybooks');
    if (saved) {
        storybooks = JSON.parse(saved);
    }
}

function saveStorybooks() {
    try {
        // 이미지를 제외한 경량 버전 저장 (용량 문제 해결)
        const lightweightBooks = storybooks.map(book => {
            const lightBook = { ...book };
            
            // 캐릭터 레퍼런스 이미지 제외
            if (lightBook.characters) {
                lightBook.characters = lightBook.characters.map(char => ({
                    ...char,
                    referenceImage: null // 이미지 제외
                }));
            }
            
            // 페이지 삽화 이미지 제외
            if (lightBook.pages) {
                lightBook.pages = lightBook.pages.map(page => ({
                    ...page,
                    illustrationImage: null // 이미지 제외
                }));
            }
            
            // 단어 이미지 제외
            if (lightBook.vocabularyImages) {
                lightBook.vocabularyImages = lightBook.vocabularyImages.map(vocab => ({
                    ...vocab,
                    imageUrl: null // 이미지 제외
                }));
            }
            
            return lightBook;
        });
        
        localStorage.setItem('storybooks', JSON.stringify(lightweightBooks));
    } catch (error) {
        console.error('LocalStorage save error:', error);
        // 용량 초과 시 가장 오래된 동화책 삭제
        if (error.name === 'QuotaExceededError' && storybooks.length > 1) {
            storybooks.shift(); // 첫 번째 항목 제거
            saveStorybooks(); // 재시도
            alert('저장 공간이 부족하여 가장 오래된 동화책이 삭제되었습니다.');
        } else {
            alert('저장 공간이 부족합니다. 브라우저 개발자 도구(F12)에서 localStorage.clear()를 실행하세요.');
        }
    }
}

function renderBookList() {
    const listDiv = document.getElementById('bookList');
    
    if (storybooks.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500 text-center py-4">아직 만든 동화책이 없어요</p>';
        return;
    }

    listDiv.innerHTML = storybooks.map((book, index) => `
        <div class="book-item ${currentStorybook && currentStorybook.id === book.id ? 'active' : ''} p-4 rounded-lg mb-2 border border-gray-200"
             onclick="selectStorybook('${book.id}')">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h3 class="font-bold text-gray-800 mb-1">${book.title}</h3>
                    <p class="text-xs text-gray-500">
                        <i class="fas fa-child mr-1"></i>${book.targetAge}세 
                        <i class="fas fa-palette ml-2 mr-1"></i>${book.artStyle}
                    </p>
                </div>
                <button 
                    onclick="event.stopPropagation(); deleteStorybook('${book.id}')"
                    class="text-red-500 hover:text-red-700 ml-2"
                >
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function selectStorybook(id) {
    currentStorybook = storybooks.find(b => b.id === id);
    if (currentStorybook) {
        displayStorybook(currentStorybook);
        renderBookList();
        document.getElementById('createForm').style.display = 'none';
    }
}

function deleteStorybook(id) {
    if (confirm('이 동화책을 삭제하시겠습니까?')) {
        storybooks = storybooks.filter(b => b.id !== id);
        saveStorybooks();
        renderBookList();
        
        if (currentStorybook && currentStorybook.id === id) {
            currentStorybook = null;
            document.getElementById('storybookResult').classList.add('hidden');
            document.getElementById('createForm').style.display = 'block';
        }
    }
}

function showCreateForm() {
    document.getElementById('createForm').style.display = 'block';
    document.getElementById('storybookResult').classList.add('hidden');
    currentStorybook = null;
    renderBookList();
}

// 동화책 생성
async function generateStorybook() {
    const title = document.getElementById('bookTitle').value.trim();
    const targetAge = document.getElementById('targetAge').value;
    const artStyle = document.getElementById('artStyle').value;

    if (!title) {
        alert('동화책 제목을 입력해주세요.');
        return;
    }

    document.getElementById('createForm').style.display = 'none';
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('storybookResult').classList.add('hidden');

    try {
        const response = await axios.post('/api/generate-storybook', {
            title,
            targetAge,
            artStyle
        });

        if (response.data.success) {
            currentStorybook = response.data.storybook;
            
            // 목록에 추가
            const index = storybooks.findIndex(b => b.id === currentStorybook.id);
            if (index !== -1) {
                storybooks[index] = currentStorybook;
            } else {
                storybooks.push(currentStorybook);
            }
            saveStorybooks();
            renderBookList();
            
            displayStorybook(currentStorybook);
        } else {
            alert(response.data.error || '동화책 생성에 실패했습니다.');
            document.getElementById('createForm').style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        alert('동화책 생성 중 오류가 발생했습니다.');
        document.getElementById('createForm').style.display = 'block';
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

function displayStorybook(storybook) {
    const resultDiv = document.getElementById('storybookResult');
    
    let html = `
        <div class="bg-white rounded-3xl shadow-2xl p-10 mb-8">
            <h2 class="text-4xl font-bold text-purple-600 mb-2">${storybook.title}</h2>
            <p class="text-gray-600">
                <i class="fas fa-child mr-2"></i>${storybook.targetAge}세 
                <i class="fas fa-palette ml-4 mr-2"></i>${storybook.artStyle}
            </p>
            <div class="bg-purple-50 p-6 rounded-lg mt-6">
                <h3 class="text-xl font-bold text-purple-600 mb-2">
                    <i class="fas fa-lightbulb mr-2"></i>주제 및 교훈
                </h3>
                <p class="text-gray-700">${storybook.theme}</p>
            </div>
        </div>

        <!-- 캐릭터 섹션 -->
        <div class="bg-white rounded-3xl shadow-2xl p-10 mb-8">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h3 class="text-3xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-users mr-2 text-purple-500"></i>
                        캐릭터 레퍼런스
                    </h3>
                    <p class="text-gray-600">
                        <i class="fas fa-info-circle mr-2"></i>
                        각 캐릭터의 레퍼런스 이미지를 생성하면 삽화에서 일관된 모습을 유지할 수 있어요.
                    </p>
                </div>
                <div class="flex gap-3">
                    <button 
                        onclick="generateAllCharacterReferences()"
                        class="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition whitespace-nowrap"
                    >
                        <i class="fas fa-images mr-2"></i>모든 레퍼런스 생성
                    </button>
                    <button 
                        onclick="addNewCharacter()"
                        class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition whitespace-nowrap"
                    >
                        <i class="fas fa-plus mr-2"></i>캐릭터 추가
                    </button>
                </div>
            </div>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${storybook.characters.map((char, idx) => `
                    <div class="character-card card rounded-xl p-6">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex-1">
                                <input 
                                    type="text" 
                                    id="char-name-${idx}" 
                                    value="${char.name}"
                                    onchange="updateCharacterName(${idx}, this.value)"
                                    class="text-2xl font-bold mb-2 bg-transparent border-b-2 border-white text-white placeholder-white w-full"
                                />
                                <span class="bg-white text-purple-600 px-3 py-1 rounded-full text-sm font-semibold">
                                    ${char.role}
                                </span>
                            </div>
                            <button 
                                onclick="deleteCharacter(${idx})"
                                class="text-white hover:text-red-300 ml-2"
                            >
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <p class="text-white text-sm mb-4 opacity-90">${char.description.substring(0, 100)}...</p>
                        <div id="char-ref-${idx}" class="mb-4 min-h-[200px] bg-white bg-opacity-20 rounded-lg flex items-center justify-center overflow-hidden">
                            ${char.referenceImage ? 
                                `<img src="${char.referenceImage}" alt="${char.name}" class="w-full h-full object-cover rounded-lg"/>` :
                                '<p class="text-white text-sm text-center p-4">이미지 생성 대기중</p>'
                            }
                        </div>
                        <textarea 
                            id="char-prompt-${idx}" 
                            class="w-full p-2 border border-white rounded-lg text-sm mb-2 bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-70"
                            rows="2"
                            placeholder="프롬프트를 수정하세요"
                        >${char.description}</textarea>
                        <div class="flex gap-2">
                            <button 
                                onclick="generateCharacterReference(${idx})"
                                class="flex-1 bg-white text-purple-600 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition"
                            >
                                <i class="fas fa-image mr-2"></i>생성
                            </button>
                            ${char.referenceImage ? 
                                `<button 
                                    onclick="downloadImage('${char.referenceImage}', '${char.name}_레퍼런스.png')"
                                    class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
                                >
                                    <i class="fas fa-download"></i>
                                </button>` : ''
                            }
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- 페이지 섹션 -->
        <div class="bg-white rounded-3xl shadow-2xl p-10 mb-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-3xl font-bold text-gray-800">
                    <i class="fas fa-book mr-2 text-purple-500"></i>
                    스토리 페이지 (${storybook.pages.length}페이지)
                </h3>
                <div class="flex gap-3">
                    <button 
                        onclick="generateAllIllustrations()"
                        class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                    >
                        <i class="fas fa-paint-brush mr-2"></i>모든 삽화 생성
                    </button>
                    <button 
                        onclick="downloadAllText()"
                        class="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
                    >
                        <i class="fas fa-file-alt mr-2"></i>전체 텍스트
                    </button>
                    <button 
                        onclick="downloadAllIllustrations()"
                        class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
                    >
                        <i class="fas fa-download mr-2"></i>전체 삽화
                    </button>
                </div>
            </div>

            <div class="space-y-6">
                ${storybook.pages.map((page, idx) => `
                    <div class="page-card">
                        <h4 class="text-2xl font-bold text-purple-600 mb-4">페이지 ${page.pageNumber}</h4>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h5 class="font-bold text-gray-700 mb-2">텍스트</h5>
                                <textarea 
                                    id="text-${idx}" 
                                    class="w-full p-4 border-2 border-gray-300 rounded-lg mb-4"
                                    rows="3"
                                    onchange="updatePageText(${idx}, this.value)"
                                >${page.text}</textarea>

                                <h5 class="font-bold text-gray-700 mb-2">장면 설명</h5>
                                <textarea 
                                    id="scene-${idx}" 
                                    class="w-full p-3 border-2 border-gray-300 rounded-lg text-sm mb-2"
                                    rows="2"
                                >${page.scene_description}</textarea>
                                
                                ${page.scene_structure ? `
                                <div class="space-y-2 mb-2">
                                    <input 
                                        id="scene-char-${idx}" 
                                        value="${page.scene_structure.characters || ''}"
                                        placeholder="캐릭터 & 행동"
                                        class="w-full p-2 border border-gray-300 rounded text-sm"
                                    />
                                    <input 
                                        id="scene-bg-${idx}" 
                                        value="${page.scene_structure.background || ''}"
                                        placeholder="배경"
                                        class="w-full p-2 border border-gray-300 rounded text-sm"
                                    />
                                    <input 
                                        id="scene-atm-${idx}" 
                                        value="${page.scene_structure.atmosphere || ''}"
                                        placeholder="분위기"
                                        class="w-full p-2 border border-gray-300 rounded text-sm"
                                    />
                                </div>
                                ` : ''}

                                <button 
                                    onclick="generateIllustration(${idx})"
                                    class="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                                >
                                    <i class="fas fa-paint-brush mr-2"></i>삽화 생성
                                </button>
                            </div>

                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <h5 class="font-bold text-gray-700">삽화</h5>
                                    ${page.illustrationImage ?
                                        `<button 
                                            onclick="downloadImage('${page.illustrationImage}', '${storybook.title}_페이지_${page.pageNumber}.png')"
                                            class="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition text-sm"
                                        >
                                            <i class="fas fa-download mr-1"></i>다운로드
                                        </button>` : ''
                                    }
                                </div>
                                <div id="illustration-${idx}" class="bg-gray-100 rounded-lg min-h-[300px] flex items-center justify-center overflow-hidden">
                                    ${page.illustrationImage ?
                                        `<img src="${page.illustrationImage}" alt="Page ${page.pageNumber}" class="w-full h-full object-cover rounded-lg"/>` :
                                        `<p class="text-gray-500 text-center p-4">
                                            <i class="fas fa-image text-4xl mb-2"></i><br>
                                            삽화 생성 버튼을 클릭하세요
                                        </p>`
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- 교육 콘텐츠 -->
        <div class="bg-white rounded-3xl shadow-2xl p-10">
            <h3 class="text-3xl font-bold text-gray-800 mb-6">
                <i class="fas fa-graduation-cap mr-2 text-purple-500"></i>
                교육 콘텐츠
            </h3>

            <div class="grid md:grid-cols-3 gap-6">
                <div class="bg-purple-50 p-6 rounded-xl">
                    <h4 class="text-xl font-bold text-purple-600 mb-4">
                        <i class="fas fa-question-circle mr-2"></i>상징으로 읽기
                    </h4>
                    <ul class="space-y-2">
                        ${storybook.educational_content.symbols.map(symbol => `
                            <li class="text-gray-700">• ${symbol}</li>
                        `).join('')}
                    </ul>
                </div>

                <div class="bg-pink-50 p-6 rounded-xl">
                    <h4 class="text-xl font-bold text-pink-600 mb-4">
                        <i class="fas fa-hands-helping mr-2"></i>창의 활동
                    </h4>
                    <p class="text-gray-700">${storybook.educational_content.activity}</p>
                </div>

                <div class="bg-blue-50 p-6 rounded-xl">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-xl font-bold text-blue-600">
                            <i class="fas fa-language mr-2"></i>영어 단어
                        </h4>
                        <button 
                            onclick="generateVocabularyImages()"
                            class="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition text-sm"
                        >
                            <i class="fas fa-images mr-1"></i>단어 이미지 생성
                        </button>
                    </div>
                    <ul class="space-y-2" id="vocabulary-list">
                        ${storybook.educational_content.vocabulary.map((word, idx) => `
                            <li class="text-gray-700">
                                <div class="flex items-center justify-between">
                                    <span>• ${word}</span>
                                    ${storybook.vocabularyImages && storybook.vocabularyImages[idx] ? 
                                        `<button 
                                            onclick="viewVocabularyImage(${idx})"
                                            class="text-blue-600 hover:text-blue-800 text-xs"
                                        >
                                            <i class="fas fa-eye"></i>
                                        </button>` : ''
                                    }
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
            
            ${storybook.vocabularyImages && storybook.vocabularyImages.length > 0 ? `
                <div class="mt-8">
                    <h4 class="text-2xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-images mr-2"></i>단어 학습 이미지
                    </h4>
                    <div class="grid md:grid-cols-4 gap-4">
                        ${storybook.vocabularyImages.map((vocabImg, idx) => `
                            <div class="bg-white p-4 rounded-lg border-2 border-blue-200">
                                <div class="bg-gray-100 rounded-lg mb-2 min-h-[150px] flex items-center justify-center overflow-hidden">
                                    ${vocabImg.imageUrl ? 
                                        `<img src="${vocabImg.imageUrl}" alt="${vocabImg.word}" class="w-full h-full object-cover rounded-lg"/>` :
                                        '<p class="text-gray-400 text-sm">생성 실패</p>'
                                    }
                                </div>
                                <p class="text-center font-bold text-gray-700">${vocabImg.word}</p>
                                ${vocabImg.imageUrl ? 
                                    `<button 
                                        onclick="downloadImage('${vocabImg.imageUrl}', '단어_${vocabImg.word}.png')"
                                        class="w-full mt-2 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition"
                                    >
                                        <i class="fas fa-download mr-1"></i>다운로드
                                    </button>` : ''
                                }
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
}

// 캐릭터 관리 함수
function updateCharacterName(charIndex, newName) {
    if (newName.trim()) {
        currentStorybook.characters[charIndex].name = newName.trim();
        saveCurrentStorybook();
    }
}

function deleteCharacter(charIndex) {
    if (confirm(`"${currentStorybook.characters[charIndex].name}" 캐릭터를 삭제하시겠습니까?`)) {
        currentStorybook.characters.splice(charIndex, 1);
        saveCurrentStorybook();
        displayStorybook(currentStorybook);
    }
}

function addNewCharacter() {
    const name = prompt('새 캐릭터 이름을 입력하세요:');
    if (!name || !name.trim()) return;
    
    const description = prompt('캐릭터 외모 설명을 영어로 입력하세요:');
    if (!description || !description.trim()) return;
    
    const role = prompt('캐릭터 역할을 입력하세요:');
    
    const newCharacter = {
        name: name.trim(),
        description: description.trim(),
        role: role ? role.trim() : '기타',
        referenceImage: null
    };
    
    currentStorybook.characters.push(newCharacter);
    saveCurrentStorybook();
    displayStorybook(currentStorybook);
    alert(`"${name}" 캐릭터가 추가되었습니다!`);
}

function updatePageText(pageIndex, newText) {
    if (newText.trim()) {
        currentStorybook.pages[pageIndex].text = newText.trim();
        saveCurrentStorybook();
    }
}

// 한 번에 모든 캐릭터 레퍼런스 생성
async function generateAllCharacterReferences() {
    if (!confirm(`${currentStorybook.characters.length}개의 캐릭터 레퍼런스를 모두 생성하시겠습니까?\n\n예상 소요 시간: 약 ${currentStorybook.characters.length * 8}초`)) {
        return;
    }
    
    for (let i = 0; i < currentStorybook.characters.length; i++) {
        if (!currentStorybook.characters[i].referenceImage) {
            await generateCharacterReference(i);
            if (i < currentStorybook.characters.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    alert('모든 캐릭터 레퍼런스 생성이 완료되었습니다!');
}

// 캐릭터 레퍼런스 생성
async function generateCharacterReference(charIndex) {
    const character = currentStorybook.characters[charIndex];
    const refDiv = document.getElementById(`char-ref-${charIndex}`);
    
    const promptTextarea = document.getElementById(`char-prompt-${charIndex}`);
    const customPrompt = promptTextarea ? promptTextarea.value.trim() : character.description;
    
    refDiv.innerHTML = '<div class="flex items-center justify-center h-full"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div><p class="text-white ml-3 text-sm">AI가 이미지 생성 중...</p></div>';

    try {
        const response = await axios.post('/api/generate-character-image', {
            character: {
                ...character,
                description: customPrompt
            },
            artStyle: currentStorybook.artStyle,
            settings: imageSettings
        });

        if (response.data.success && response.data.imageUrl) {
            const imageUrl = response.data.imageUrl;
            currentStorybook.characters[charIndex].referenceImage = imageUrl;
            saveCurrentStorybook();
            
            refDiv.innerHTML = `<img src="${imageUrl}" alt="${character.name}" class="w-full h-full object-cover rounded-lg"/>`;
            displayStorybook(currentStorybook);
        } else {
            throw new Error(response.data.error || '이미지 URL을 받지 못했습니다.');
        }

    } catch (error) {
        console.error('Error:', error);
        refDiv.innerHTML = `
            <div class="p-4 text-center">
                <p class="text-white text-xs mt-2">⚠️ 이미지 생성 실패</p>
                <p class="text-white text-xs opacity-75 mt-1">${error.message}</p>
                <button onclick="generateCharacterReference(${charIndex})" class="mt-2 px-3 py-1 bg-white text-purple-600 rounded text-xs">재시도</button>
            </div>
        `;
    }
}

// 한 번에 모든 삽화 생성
async function generateAllIllustrations() {
    const hasCharacterReferences = currentStorybook.characters.some(char => char.referenceImage);
    if (!hasCharacterReferences) {
        alert('먼저 캐릭터 레퍼런스 이미지를 생성해주세요!');
        return;
    }
    
    const pagesToGenerate = currentStorybook.pages.filter(page => !page.illustrationImage);
    
    if (pagesToGenerate.length === 0) {
        alert('이미 모든 페이지의 삽화가 생성되었습니다.');
        return;
    }
    
    if (!confirm(`${pagesToGenerate.length}개의 삽화를 생성하시겠습니까?\n\n예상 소요 시간: 약 ${pagesToGenerate.length * 8}초`)) {
        return;
    }
    
    for (let i = 0; i < currentStorybook.pages.length; i++) {
        if (!currentStorybook.pages[i].illustrationImage) {
            await generateIllustration(i);
            if (i < currentStorybook.pages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    alert('모든 삽화 생성이 완료되었습니다!');
}

// 페이지 삽화 생성
async function generateIllustration(pageIndex) {
    const page = currentStorybook.pages[pageIndex];
    const sceneDesc = document.getElementById(`scene-${pageIndex}`).value;
    const illustrationDiv = document.getElementById(`illustration-${pageIndex}`);
    
    const sceneCharElem = document.getElementById(`scene-char-${pageIndex}`);
    const sceneBgElem = document.getElementById(`scene-bg-${pageIndex}`);
    const sceneAtmElem = document.getElementById(`scene-atm-${pageIndex}`);
    
    const sceneStructure = {
        characters: sceneCharElem ? sceneCharElem.value : '',
        background: sceneBgElem ? sceneBgElem.value : '',
        atmosphere: sceneAtmElem ? sceneAtmElem.value : ''
    };
    
    const characterReferences = currentStorybook.characters
        .filter(char => char.referenceImage)
        .map(char => ({
            name: char.name,
            description: char.description,
            referenceImage: char.referenceImage
        }));
    
    if (characterReferences.length === 0) {
        alert('먼저 캐릭터 레퍼런스 이미지를 생성해주세요!');
        return;
    }
    
    illustrationDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-4"><div class="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mb-3"></div><p class="text-gray-600 text-sm">AI가 삽화를 생성하는 중...</p></div>';

    try {
        const response = await axios.post('/api/generate-illustration', {
            page: {
                ...page,
                scene_description: sceneDesc,
                scene_structure: sceneStructure
            },
            artStyle: currentStorybook.artStyle,
            characterReferences: characterReferences,
            settings: imageSettings
        });

        if (response.data.success && response.data.imageUrl) {
            const imageUrl = response.data.imageUrl;
            currentStorybook.pages[pageIndex].illustrationImage = imageUrl;
            currentStorybook.pages[pageIndex].scene_description = sceneDesc;
            currentStorybook.pages[pageIndex].scene_structure = sceneStructure;
            saveCurrentStorybook();
            
            illustrationDiv.innerHTML = `<img src="${imageUrl}" alt="Page ${page.pageNumber}" class="w-full h-full object-cover rounded-lg"/>`;
            displayStorybook(currentStorybook);
        } else {
            throw new Error(response.data.error || '이미지 URL을 받지 못했습니다.');
        }

    } catch (error) {
        console.error('Error:', error);
        illustrationDiv.innerHTML = `
            <div class="p-6 text-center">
                <p class="text-gray-600 text-sm mb-2">⚠️ 이미지 생성 실패</p>
                <p class="text-gray-500 text-xs">${error.message}</p>
                <button 
                    onclick="generateIllustration(${pageIndex})"
                    class="mt-3 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm"
                >
                    <i class="fas fa-redo mr-2"></i>재시도
                </button>
            </div>
        `;
    }
}

function saveCurrentStorybook() {
    const index = storybooks.findIndex(b => b.id === currentStorybook.id);
    if (index !== -1) {
        storybooks[index] = currentStorybook;
    } else {
        storybooks.push(currentStorybook);
    }
    saveStorybooks();
    renderBookList();
}

// 다운로드 함수들
async function downloadAllIllustrations() {
    const images = currentStorybook.pages
        .filter(page => page.illustrationImage)
        .map((page, idx) => ({
            url: page.illustrationImage,
            filename: `${currentStorybook.title}_page_${page.pageNumber}.png`
        }));
    
    if (images.length === 0) {
        alert('다운로드할 삽화가 없습니다.');
        return;
    }
    
    for (const img of images) {
        try {
            const response = await fetch(img.url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = img.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('Download error:', error);
        }
    }
    
    alert(`${images.length}개의 삽화를 다운로드했습니다.`);
}

function downloadAllText() {
    if (!currentStorybook || !currentStorybook.pages || currentStorybook.pages.length === 0) {
        alert('다운로드할 텍스트가 없습니다.');
        return;
    }
    
    let textContent = `${currentStorybook.title}\n\n`;
    textContent += `대상 연령: ${currentStorybook.targetAge}세\n`;
    textContent += `그림체: ${currentStorybook.artStyle}\n\n`;
    textContent += `주제: ${currentStorybook.theme}\n\n`;
    textContent += `=`.repeat(50) + '\n\n';
    
    currentStorybook.pages.forEach((page, idx) => {
        textContent += `[페이지 ${page.pageNumber}]\n${page.text}\n`;
        if (idx < currentStorybook.pages.length - 1) {
            textContent += '\n---\n\n';
        }
    });
    
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentStorybook.title}_전체_텍스트.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    alert('텍스트 파일이 다운로드되었습니다.');
}

async function downloadImage(imageUrl, filename) {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Download error:', error);
        alert('이미지 다운로드에 실패했습니다.');
    }
}

// 단어 이미지 생성
async function generateVocabularyImages() {
    if (!currentStorybook.educational_content || !currentStorybook.educational_content.vocabulary) {
        alert('단어 목록이 없습니다.');
        return;
    }
    
    const vocabulary = currentStorybook.educational_content.vocabulary;
    
    if (!confirm(`${vocabulary.length}개의 단어 이미지를 생성하시겠습니까?\n\n예상 소요 시간: 약 ${vocabulary.length * 8}초`)) {
        return;
    }
    
    const vocabList = document.getElementById('vocabulary-list');
    const originalHTML = vocabList.innerHTML;
    vocabList.innerHTML = '<li class="text-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div><p class="text-sm text-gray-600 mt-2">단어 이미지 생성 중...</p></li>';
    
    try {
        const response = await axios.post('/api/generate-vocabulary-images', {
            vocabulary: vocabulary,
            artStyle: currentStorybook.artStyle,
            settings: imageSettings
        });
        
        if (response.data.success) {
            currentStorybook.vocabularyImages = response.data.images;
            saveCurrentStorybook();
            displayStorybook(currentStorybook);
            alert(`${response.data.successful}/${response.data.total}개의 단어 이미지가 생성되었습니다!`);
        } else {
            throw new Error(response.data.error);
        }
        
    } catch (error) {
        console.error('Error:', error);
        vocabList.innerHTML = originalHTML;
        alert('단어 이미지 생성 중 오류가 발생했습니다: ' + error.message);
    }
}

function viewVocabularyImage(index) {
    if (currentStorybook.vocabularyImages && currentStorybook.vocabularyImages[index]) {
        const vocabImg = currentStorybook.vocabularyImages[index];
        if (vocabImg.imageUrl) {
            window.open(vocabImg.imageUrl, '_blank');
        }
    }
}
