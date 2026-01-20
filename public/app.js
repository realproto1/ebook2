// 전역 변수
let storybooks = [];
let currentStorybook = null;
let imageSettings = {
    aspectRatio: '16:9',
    enforceNoText: true,
    enforceCharacterConsistency: true,
    additionalPrompt: '',
    imageQuality: 'high',
    imageModel: 'gemini-3-pro-image-preview',  // 기본값: Nano Banana Pro (Gemini 3 Pro Image Preview)
    characterModel: 'gemini-3-pro-image-preview',  // 캐릭터 레퍼런스 모델
    keyObjectModel: 'gemini-3-pro-image-preview',  // Key Object 모델
    illustrationModel: 'gemini-3-pro-image-preview',  // 페이지 삽화 모델
    vocabularyModel: 'gemini-3-pro-image-preview',  // 8단어 학습 모델
    coverModel: 'gemini-3-pro-image-preview',  // 표지 모델
    ttsModel: 'ko-KR-Wavenet-A',  // TTS 모델 (Google Cloud TTS with Gemini API Key)
    ttsVoiceConfig: '여성 목소리, 부드럽고 따뜻한 톤, 동화 낭독 스타일, 적당한 속도로 또박또박, 어린이가 이해하기 쉽게'  // TTS 음성 설정
};

// 이미지 모델 목록
const IMAGE_MODELS = [
    { value: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro (Gemini 3 Pro) ⭐', description: '최고 품질, 네이티브 이미지 생성' },
    { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', description: '빠르고 저렴한 이미지 생성' },
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (실험)', description: '무료 테스트용' },
    { value: 'imagen-4', label: 'Imagen 4', description: '전문 이미지, 텍스트 렌더링 우수' }
];

// TTS 모델 목록 (Google Cloud Text-to-Speech with Gemini API Key)
const TTS_MODELS = [
    { value: 'ko-KR-Wavenet-A', label: '한국어 여성 (Wavenet-A) ⭐', description: '자연스럽고 부드러운 여성 목소리' },
    { value: 'ko-KR-Wavenet-B', label: '한국어 여성 (Wavenet-B)', description: '밝고 경쾌한 여성 목소리' },
    { value: 'ko-KR-Wavenet-C', label: '한국어 남성 (Wavenet-C)', description: '깊고 안정적인 남성 목소리' },
    { value: 'ko-KR-Wavenet-D', label: '한국어 남성 (Wavenet-D)', description: '차분하고 따뜻한 남성 목소리' }
];

// 모델 선택 HTML 생성 함수
function createModelSelect(sectionName, currentModel, onChangeFunction) {
    const modelOptions = IMAGE_MODELS.map(model => 
        `<option value="${model.value}" ${currentModel === model.value ? 'selected' : ''}>${model.label}</option>`
    ).join('');
    
    return `
        <div class="flex items-center gap-2">
            <i class="fas fa-robot text-gray-600"></i>
            <select 
                id="${sectionName}-model-select"
                onchange="${onChangeFunction}"
                class="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
            >
                ${modelOptions}
            </select>
        </div>
    `;
}

// 캐릭터 레퍼런스 모델 변경
function updateCharacterModel(value) {
    imageSettings.characterModel = value;
    saveImageSettings();
    console.log('✅ 캐릭터 레퍼런스 모델 변경:', value);
}

// Key Object 모델 변경
function updateKeyObjectModel(value) {
    imageSettings.keyObjectModel = value;
    saveImageSettings();
    console.log('✅ Key Object 모델 변경:', value);
}

// 페이지 삽화 모델 변경
function updateIllustrationModel(value) {
    imageSettings.illustrationModel = value;
    saveImageSettings();
    console.log('✅ 페이지 삽화 모델 변경:', value);
}

// 8단어 학습 모델 변경
function updateVocabularyModel(value) {
    imageSettings.vocabularyModel = value;
    saveImageSettings();
    console.log('✅ 8단어 학습 모델 변경:', value);
}

// TTS 모델 선택 HTML 생성
function createTTSModelSelect(currentModel, pageIndex) {
    const modelOptions = TTS_MODELS.map(model => 
        `<option value="${model.value}" ${currentModel === model.value ? 'selected' : ''}>${model.label}</option>`
    ).join('');
    
    return `
        <select 
            id="tts-model-select-${pageIndex}"
            onchange="updatePageTTSModel(${pageIndex}, this.value)"
            class="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
        >
            ${modelOptions}
        </select>
    `;
}

// TTS 모델 변경
function updateTTSModel(value) {
    imageSettings.ttsModel = value;
    saveImageSettings();
    console.log('✅ TTS 모델 변경:', value);
}

// TTS 음성 설정 변경
function updateTTSVoiceConfig(value) {
    imageSettings.ttsVoiceConfig = value;
    saveImageSettings();
    console.log('✅ TTS 음성 설정 변경:', value);
}

// 페이지 TTS 생성
async function generatePageTTS(pageIndex) {
    if (!currentStorybook || !currentStorybook.pages[pageIndex]) {
        alert('페이지 정보가 없습니다.');
        return;
    }
    
    const page = currentStorybook.pages[pageIndex];
    const text = page.text;
    
    if (!text || text.trim().length === 0) {
        alert('텍스트가 없습니다.');
        return;
    }
    
    const ttsButton = document.getElementById(`tts-btn-${pageIndex}`);
    const ttsPlayer = document.getElementById(`tts-player-${pageIndex}`);
    
    // 로딩 표시
    if (ttsButton) {
        ttsButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>생성중...';
        ttsButton.disabled = true;
    }
    
    try {
        const response = await axios.post('/api/generate-tts', {
            text: text,
            model: imageSettings.ttsModel,
            voiceConfig: imageSettings.ttsVoiceConfig
        });
        
        if (response.data.success && response.data.audioUrl) {
            // TTS 저장
            if (!currentStorybook.pages[pageIndex].ttsAudio) {
                currentStorybook.pages[pageIndex].ttsAudio = {};
            }
            currentStorybook.pages[pageIndex].ttsAudio.url = response.data.audioUrl;
            currentStorybook.pages[pageIndex].ttsAudio.model = imageSettings.ttsModel;
            saveCurrentStorybook();
            
            // 플레이어 표시
            if (ttsPlayer) {
                ttsPlayer.innerHTML = `
                    <audio controls class="w-full">
                        <source src="${response.data.audioUrl}" type="audio/mpeg">
                        브라우저가 오디오를 지원하지 않습니다.
                    </audio>
                `;
                ttsPlayer.classList.remove('hidden');
            }
            
            // 버튼 업데이트
            if (ttsButton) {
                ttsButton.innerHTML = '<i class="fas fa-redo mr-1"></i>재생성';
                ttsButton.disabled = false;
            }
            
            showNotification('success', 'TTS 생성 완료!', '음성이 생성되었습니다.');
        } else {
            throw new Error(response.data.error || 'TTS 생성 실패');
        }
    } catch (error) {
        console.error('TTS 생성 오류:', error);
        alert('TTS 생성 중 오류가 발생했습니다: ' + (error.response?.data?.error || error.message));
        
        // 버튼 복원
        if (ttsButton) {
            ttsButton.innerHTML = '<i class="fas fa-volume-up mr-1"></i>음성 생성';
            ttsButton.disabled = false;
        }
    }
}

// 표지 모델 변경
function updateCoverModel(value) {
    imageSettings.coverModel = value;
    saveImageSettings();
    console.log('✅ 표지 모델 변경:', value);
}

// 표지 프롬프트 생성
function buildCoverPrompt(storybook) {
    const title = storybook.title || '동화책';
    const theme = storybook.theme || '';
    const artStyle = storybook.artStyle || 'Disney animation style';
    const characters = storybook.characters.map(c => c.name).join(', ');
    
    return `Create a beautiful, professional book cover illustration for a children's storybook.

**Book Title:** ${title}
**Theme:** ${theme}
**Art Style:** ${artStyle}

**Main Characters:** ${characters}

**Cover Requirements:**
- Eye-catching, vibrant illustration that captures the story's essence
- Show the main characters in an engaging scene
- Magical, inviting atmosphere suitable for children ages 4-8
- Professional book cover quality
- Composition suitable for a vertical book cover layout

**DO NOT include:**
- Any text, title, or letters on the cover
- Book spine or binding elements
- Just pure illustration

Create a captivating cover illustration that makes children want to read this story!`;
}

// 표지 프롬프트 초기화
function resetCoverPrompt() {
    if (!currentStorybook) return;
    const promptTextarea = document.getElementById('cover-prompt');
    if (promptTextarea) {
        promptTextarea.value = buildCoverPrompt(currentStorybook);
        currentStorybook.coverPrompt = promptTextarea.value;
        saveCurrentStorybook();
    }
}

// 표지 캐릭터 참조 토글
function toggleCoverCharacterRef(charIndex, checked) {
    if (!currentStorybook) return;
    
    if (!currentStorybook.coverCharacterRefs) {
        currentStorybook.coverCharacterRefs = [];
    }
    
    if (checked) {
        if (!currentStorybook.coverCharacterRefs.includes(charIndex)) {
            currentStorybook.coverCharacterRefs.push(charIndex);
        }
    } else {
        currentStorybook.coverCharacterRefs = currentStorybook.coverCharacterRefs.filter(i => i !== charIndex);
    }
    
    saveCurrentStorybook();
    console.log('✅ 표지 캐릭터 참조 업데이트:', currentStorybook.coverCharacterRefs);
}

// 표지 이미지 생성
async function generateCoverImage() {
    if (!currentStorybook) {
        alert('동화책을 먼저 선택해주세요.');
        return;
    }
    
    const promptTextarea = document.getElementById('cover-prompt');
    const customPrompt = promptTextarea ? promptTextarea.value.trim() : '';
    
    if (!customPrompt) {
        alert('표지 프롬프트를 입력해주세요.');
        return;
    }
    
    const coverDisplay = document.getElementById('cover-image-display');
    coverDisplay.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-6"><div class="animate-spin rounded-full h-16 w-16 border-b-4 border-white mb-3"></div><p class="text-white text-sm font-semibold">AI가 표지를 생성하는 중...</p><p class="text-white text-xs opacity-75 mt-1">실패 시 자동으로 재시도합니다</p></div>';
    
    try {
        // 참조할 캐릭터 레퍼런스 수집
        const refImageUrls = [];
        if (currentStorybook.coverCharacterRefs && currentStorybook.coverCharacterRefs.length > 0) {
            currentStorybook.coverCharacterRefs.forEach(charIdx => {
                const char = currentStorybook.characters[charIdx];
                if (char && char.referenceImage) {
                    refImageUrls.push(char.referenceImage);
                }
            });
        }
        
        console.log(`📚 표지 생성 시작 - 참조 캐릭터: ${refImageUrls.length}개`);
        
        // 재생성인 경우 기존 표지 이미지도 참조로 추가
        if (currentStorybook.coverImage) {
            console.log('🔄 재생성 모드: 기존 표지를 레퍼런스로 추가');
            refImageUrls.push(currentStorybook.coverImage);
        }
        
        const result = await generateImageClient(customPrompt, refImageUrls, 3, imageSettings.coverModel || 'gemini-3-pro-image-preview');
        
        if (result.success && result.imageUrl) {
            currentStorybook.coverImage = result.imageUrl;
            currentStorybook.coverPrompt = customPrompt;
            saveCurrentStorybook();
            
            // UI 업데이트
            displayStorybook(currentStorybook);
            
            showNotification('success', '표지 생성 완료!', '동화책 표지가 생성되었습니다.');
        } else {
            throw new Error(result.error || '이미지 생성 실패');
        }
    } catch (error) {
        console.error('표지 생성 오류:', error);
        coverDisplay.innerHTML = `
            <div class="text-center p-6">
                <i class="fas fa-exclamation-triangle text-6xl text-white opacity-50 mb-4"></i>
                <p class="text-white text-sm mb-2">⚠️ 생성 실패</p>
                <p class="text-white text-xs opacity-75">${error.message}</p>
                <button 
                    onclick="generateCoverImage()"
                    class="mt-4 bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition"
                >
                    <i class="fas fa-redo mr-2"></i>재시도
                </button>
            </div>
        `;
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadImageSettings();
    loadStorybooks();
    renderBookList();
});

// 모바일 사이드바 토글 함수
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
}

// 섹션 토글 함수
function toggleSection(sectionId) {
    const content = document.getElementById(sectionId + '-content');
    const icon = document.getElementById(sectionId + '-icon');
    
    // 요소가 없으면 무시
    if (!content || !icon) {
        console.warn(`Section ${sectionId} not found`);
        return;
    }
    
    if (content.classList.contains('hidden')) {
        // 섹션 열기
        content.classList.remove('hidden');
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
    } else {
        // 섹션 닫기
        content.classList.add('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
    }
}

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
    
    // 각 섹션별 모델 선택값 복원
    document.getElementById('characterModelSelect').value = imageSettings.characterModel || 'gemini-3-pro-image-preview';
    document.getElementById('keyObjectModelSelect').value = imageSettings.keyObjectModel || 'gemini-3-pro-image-preview';
    document.getElementById('illustrationModelSelect').value = imageSettings.illustrationModel || 'gemini-3-pro-image-preview';
    document.getElementById('vocabularyModelSelect').value = imageSettings.vocabularyModel || 'gemini-3-pro-image-preview';
    
    // API 키 로드 (localStorage에서)
    const savedApiKey = localStorage.getItem('gemini_api_key') || '';
    document.getElementById('geminiApiKey').value = savedApiKey;
    
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
    
    // 각 섹션별 모델 설정 저장
    imageSettings.characterModel = document.getElementById('characterModelSelect').value;
    imageSettings.keyObjectModel = document.getElementById('keyObjectModelSelect').value;
    imageSettings.illustrationModel = document.getElementById('illustrationModelSelect').value;
    imageSettings.vocabularyModel = document.getElementById('vocabularyModelSelect').value;
    
    console.log('💾 이미지 설정 저장:', imageSettings);
    
    // API 키 저장 (localStorage에)
    const apiKey = document.getElementById('geminiApiKey').value.trim();
    if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
        // gemini-client.js의 GEMINI_API_KEY 업데이트
        if (typeof GEMINI_API_KEY !== 'undefined') {
            GEMINI_API_KEY = apiKey;
            console.log('✅ 커스텀 Gemini API 키 적용됨');
        }
    } else {
        localStorage.removeItem('gemini_api_key');
        // 기본 키로 복원 (서버에서 다시 가져오기)
        if (typeof initGeminiAPIKey === 'function') {
            initGeminiAPIKey();
            console.log('✅ 기본 Gemini API 키로 복원');
        }
    }
    
    saveImageSettings();
    closeSettings();
    showNotification('success', '설정 저장 완료', '설정이 성공적으로 저장되었습니다.');
}

function resetSettings() {
    if (confirm('모든 설정을 기본값으로 복원하시겠습니까?\n\n⚠️ 주의: API 키도 기본값으로 복원됩니다.')) {
        imageSettings = {
            aspectRatio: '16:9',
            enforceNoText: true,
            enforceCharacterConsistency: true,
            additionalPrompt: '',
            imageQuality: 'high',
            imageModel: 'gemini-3-pro-image-preview'  // Nano Banana Pro
        };
        
        // API 키 초기화
        localStorage.removeItem('gemini_api_key');
        document.getElementById('geminiApiKey').value = '';
        
        // 기본 키로 복원
        if (typeof initGeminiAPIKey === 'function') {
            initGeminiAPIKey();
        }
        
        saveImageSettings();
        openSettings();
        showNotification('success', '설정 복원 완료', '모든 설정이 기본값으로 복원되었습니다.');
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
    
    console.log('📋 renderBookList 호출 - 동화책 개수:', storybooks.length);
    
    if (storybooks.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-500 text-center py-4">아직 만든 동화책이 없어요</p>';
        return;
    }

    listDiv.innerHTML = storybooks.map((book, index) => `
        <div 
            class="book-item ${currentStorybook && currentStorybook.id === book.id ? 'active' : ''} p-3 rounded-lg mb-2 border border-gray-200 cursor-move"
            draggable="true"
            data-book-id="${book.id}"
            data-book-index="${index}"
            ondragstart="handleDragStart(event)"
            ondragover="handleDragOver(event)"
            ondragenter="handleDragEnter(event)"
            ondragleave="handleDragLeave(event)"
            ondrop="handleDrop(event)"
            ondragend="handleDragEnd(event)"
        >
            <!-- 드래그 핸들 & 제목 -->
            <div class="flex items-start gap-2 mb-2">
                <div class="text-gray-400 cursor-move mt-1" title="드래그하여 순서 변경">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="flex-1 min-w-0" onclick="selectStorybook('${book.id}')">
                    <input 
                        type="text" 
                        value="${book.title}"
                        class="w-full font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 outline-none text-sm px-1 -ml-1"
                        onclick="event.stopPropagation(); this.select();"
                        onchange="updateBookTitleInList('${book.id}', this.value)"
                        onblur="this.classList.remove('border-purple-500')"
                        title="클릭하여 제목 수정"
                    />
                    <p class="text-xs text-gray-500 mt-1 px-1">
                        <i class="fas fa-child mr-1"></i>${book.targetAge}세 
                        <i class="fas fa-file-alt ml-2 mr-1"></i>${book.pages.length}p
                    </p>
                </div>
            </div>
            
            <!-- 버튼 그룹 -->
            <div class="flex gap-1 mt-2 px-1">
                <button 
                    onclick="event.stopPropagation(); selectStorybook('${book.id}')"
                    class="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs py-1.5 rounded transition"
                    title="열기"
                >
                    <i class="fas fa-folder-open mr-1"></i>열기
                </button>
                <button 
                    onclick="event.stopPropagation(); duplicateStorybookById('${book.id}')"
                    class="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs py-1.5 rounded transition"
                    title="복사"
                >
                    <i class="fas fa-copy mr-1"></i>복사
                </button>
                <button 
                    onclick="event.stopPropagation(); deleteStorybook('${book.id}')"
                    class="bg-red-100 hover:bg-red-200 text-red-700 text-xs py-1.5 px-3 rounded transition"
                    title="삭제"
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
        // 모바일에서 사이드바 자동 닫기
        closeMobileSidebar();
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

// 동화책 제목 업데이트 (사이드바)
function updateBookTitleInList(id, newTitle) {
    if (!newTitle.trim()) {
        showNotification('warning', '제목을 입력해주세요.');
        renderBookList();
        return;
    }
    
    const book = storybooks.find(b => b.id === id);
    if (!book) return;
    
    const oldTitle = book.title;
    book.title = newTitle.trim();
    
    // 현재 열려있는 동화책이면 업데이트
    if (currentStorybook && currentStorybook.id === id) {
        currentStorybook.title = newTitle.trim();
        displayStorybook(currentStorybook);
    }
    
    saveStorybooks();
    
    console.log(`✅ 제목 변경: "${oldTitle}" → "${newTitle.trim()}"`);
    showNotification('success', '제목이 저장되었습니다!');
}

// 드래그 앤 드롭 관련 변수
let draggedElement = null;
let draggedIndex = null;

// 드래그 시작
function handleDragStart(e) {
    draggedElement = e.currentTarget;
    draggedIndex = parseInt(e.currentTarget.dataset.bookIndex);
    e.currentTarget.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    
    console.log('🖐️ 드래그 시작:', draggedIndex);
}

// 드래그 오버
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

// 드래그 진입
function handleDragEnter(e) {
    if (e.currentTarget !== draggedElement) {
        e.currentTarget.classList.add('border-purple-500', 'bg-purple-50');
    }
}

// 드래그 떠남
function handleDragLeave(e) {
    e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50');
}

// 드롭
function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();
    
    if (draggedElement !== e.currentTarget) {
        const targetIndex = parseInt(e.currentTarget.dataset.bookIndex);
        
        // 배열에서 순서 변경
        const draggedBook = storybooks[draggedIndex];
        storybooks.splice(draggedIndex, 1);
        storybooks.splice(targetIndex, 0, draggedBook);
        
        console.log(`✅ 순서 변경: ${draggedIndex} → ${targetIndex}`);
        
        saveStorybooks();
        renderBookList();
        
        showNotification('success', '순서가 변경되었습니다!');
    }
    
    e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50');
    return false;
}

// 드래그 종료
function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    
    // 모든 요소의 하이라이트 제거
    document.querySelectorAll('.book-item').forEach(item => {
        item.classList.remove('border-purple-500', 'bg-purple-50');
    });
    
    draggedElement = null;
    draggedIndex = null;
}

// 동화책 제목 업데이트 (메인 페이지)
function updateStorybookTitle(newTitle) {
    if (!currentStorybook || !newTitle.trim()) {
        alert('제목을 입력해주세요.');
        return;
    }
    
    const oldTitle = currentStorybook.title;
    currentStorybook.title = newTitle.trim();
    
    // storybooks 배열에서도 업데이트
    const index = storybooks.findIndex(b => b.id === currentStorybook.id);
    if (index !== -1) {
        storybooks[index].title = newTitle.trim();
    }
    
    saveStorybooks();
    renderBookList();
    
    console.log(`✅ 제목 변경: "${oldTitle}" → "${newTitle.trim()}"`);
    
    // 제목 업데이트 알림
    showNotification('success', '제목이 저장되었습니다!');
}

// 동화책 복사 (현재 동화책)
function duplicateStorybook() {
    if (!currentStorybook) {
        alert('복사할 동화책이 없습니다.');
        return;
    }
    duplicateStorybookById(currentStorybook.id);
}

// ID로 동화책 복사 (사이드바에서 호출)
function duplicateStorybookById(id) {
    const book = storybooks.find(b => b.id === id);
    if (!book) {
        alert('동화책을 찾을 수 없습니다.');
        return;
    }
    
    // 깊은 복사 (이미지 URL 포함)
    const duplicate = JSON.parse(JSON.stringify(book));
    
    // 새 ID 생성
    duplicate.id = Date.now().toString();
    
    // 제목에 "(복사본)" 추가
    duplicate.title = `${book.title} (복사본)`;
    
    // 동화책 목록에 추가
    storybooks.unshift(duplicate);
    saveStorybooks();
    
    // 복사본 선택
    currentStorybook = duplicate;
    renderBookList();
    displayStorybook(duplicate);
    
    console.log(`✅ 동화책 복사 완료: "${duplicate.title}" (ID: ${duplicate.id})`);
    
    // 복사 완료 알림
    showNotification('success', '복사 완료!', `"${duplicate.title}"이 생성되었습니다.`);
}

// 알림 표시 함수
function showNotification(type, title, message) {
    const colors = {
        success: 'bg-green-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500'
    };
    
    const icons = {
        success: 'fa-check-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-times-circle'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in max-w-sm`;
    notification.innerHTML = `
        <div class="flex items-start gap-3">
            <i class="fas ${icons[type] || icons.info} text-xl mt-0.5"></i>
            <div>
                <strong class="block">${title}</strong>
                ${message ? `<span class="text-sm block mt-1">${message}</span>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 모달 표시 함수
function showModal(title, content) {
    // 기존 모달 제거
    const existingModal = document.getElementById('custom-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 모달 생성
    const modal = document.createElement('div');
    modal.id = 'custom-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
                <h2 class="text-2xl font-bold text-gray-800">${title}</h2>
                <button 
                    onclick="document.getElementById('custom-modal').remove()"
                    class="text-gray-400 hover:text-gray-600 transition"
                >
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            <div class="px-6 py-6">
                ${content}
            </div>
            <div class="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end rounded-b-2xl border-t border-gray-200">
                <button 
                    onclick="document.getElementById('custom-modal').remove()"
                    class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
                >
                    닫기
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 배경 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 그림체 선택 변경 핸들러
function handleArtStyleChange() {
    const select = document.getElementById('artStyleSelect');
    const customInput = document.getElementById('artStyleCustom');
    
    if (select.value === 'custom') {
        customInput.classList.remove('hidden');
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
    }
}

function showCreateForm() {
    document.getElementById('createForm').style.display = 'block';
    document.getElementById('storybookResult').classList.add('hidden');
    currentStorybook = null;
    renderBookList();
    // 모바일에서 사이드바 자동 닫기
    closeMobileSidebar();
}

// 동화책 생성
async function generateStorybook() {
    const title = document.getElementById('bookTitle').value.trim();
    const targetAge = document.getElementById('targetAge').value;
    const totalPages = parseInt(document.getElementById('totalPages').value) || 0; // 0 = AI 자동 결정
    const geminiModel = document.getElementById('geminiModel').value; // AI 모델 선택
    const artStyleSelect = document.getElementById('artStyleSelect').value;
    const artStyleCustom = document.getElementById('artStyleCustom').value.trim();
    const referenceContent = document.getElementById('referenceContent').value.trim();
    
    // 이미지 AI 모델 선택 (동화책 생성 폼에서)
    const imageModelSelect = document.getElementById('imageModelSelect');
    if (imageModelSelect) {
        imageSettings.imageModel = imageModelSelect.value;
        saveImageSettings();
        console.log('🤖 이미지 AI 모델 설정됨:', imageSettings.imageModel);
    }
    
    // 그림체 결정: custom이면 직접 입력값 사용, 아니면 선택값 사용
    const artStyle = artStyleSelect === 'custom' ? artStyleCustom : artStyleSelect;

    if (!title) {
        alert('동화책 제목을 입력해주세요.');
        return;
    }
    
    if (artStyleSelect === 'custom' && !artStyleCustom) {
        alert('그림체를 입력해주세요.');
        return;
    }
    
    // 페이지 수 검증 (0은 자동, 1-30은 사용자 지정)
    if (totalPages < 0 || totalPages > 30) {
        alert('페이지 수는 0(자동) 또는 1-30 사이여야 합니다.');
        return;
    }

    document.getElementById('createForm').style.display = 'none';
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('storybookResult').classList.add('hidden');

    try {
        const response = await axios.post('/api/generate-storybook', {
            title,
            targetAge,
            totalPages,
            geminiModel, // AI 모델 전달
            artStyle,
            referenceContent: referenceContent || null
        });

        if (response.data.success) {
            currentStorybook = response.data.storybook;
            
            console.log('✅ 동화책 생성 성공:', currentStorybook.title, 'ID:', currentStorybook.id);
            
            // 목록에 추가
            const index = storybooks.findIndex(b => b.id === currentStorybook.id);
            if (index !== -1) {
                console.log('📝 기존 동화책 업데이트:', index);
                storybooks[index] = currentStorybook;
            } else {
                console.log('➕ 새 동화책 추가');
                storybooks.push(currentStorybook);
            }
            
            console.log('💾 저장 전 목록 개수:', storybooks.length);
            saveStorybooks();
            console.log('🎨 목록 렌더링 시작');
            renderBookList();
            console.log('📚 현재 목록:', storybooks.map(b => b.title));
            
            displayStorybook(currentStorybook);
        } else {
            alert(response.data.error || '동화책 생성에 실패했습니다.');
            document.getElementById('createForm').style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        let errorMessage = '동화책 생성 중 오류가 발생했습니다.';
        
        if (error.response && error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        alert(errorMessage + '\n\n잠시 후 다시 시도해주세요.');
        document.getElementById('createForm').style.display = 'block';
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

function displayStorybook(storybook) {
    const resultDiv = document.getElementById('storybookResult');
    
    let html = `
        <div class="bg-white rounded-3xl shadow-2xl p-4 md:p-10 mb-8">
            <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-0 mb-4">
                <div class="flex-1">
                    <h2 class="text-2xl md:text-4xl font-bold text-purple-600 mb-2">${storybook.title}</h2>
                    <p class="text-sm md:text-base text-gray-600">
                        <i class="fas fa-child mr-1 md:mr-2"></i>${storybook.targetAge}세 
                        <i class="fas fa-palette ml-2 md:ml-4 mr-1 md:mr-2"></i><span class="hidden sm:inline">${storybook.artStyle}</span>
                        <i class="fas fa-file-alt ml-2 md:ml-4 mr-1 md:mr-2"></i>${storybook.pages.length}페이지
                    </p>
                    <p class="text-xs text-gray-400 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>
                        좌측 사이드바에서 제목 수정, 복사, 순서 변경이 가능합니다
                    </p>
                </div>
                <button 
                    onclick="openRegenerateModal()"
                    class="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 md:px-5 py-2 md:py-3 rounded-lg font-bold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg text-sm md:text-base whitespace-nowrap"
                >
                    <i class="fas fa-redo mr-1 md:mr-2"></i><span class="hidden sm:inline">다시 만들기</span><span class="sm:hidden">재생성</span>
                </button>
            </div>
            <div class="bg-purple-50 p-4 md:p-6 rounded-lg mt-4 md:mt-6">
                <h3 class="text-lg md:text-xl font-bold text-purple-600 mb-2">
                    <i class="fas fa-lightbulb mr-2"></i>주제 및 교훈
                </h3>
                <p class="text-sm md:text-base text-gray-700">${storybook.theme}</p>
            </div>
        </div>

        <!-- 캐릭터 섹션 -->
        <div class="bg-white rounded-3xl shadow-2xl p-4 md:p-10 mb-8">
            <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-4 md:mb-6">
                <div class="flex-1">
                    <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2 cursor-pointer flex items-center" onclick="toggleSection('character-section')">
                        <i id="character-section-icon" class="fas fa-chevron-down mr-2 text-sm transition-transform"></i>
                        <i class="fas fa-users mr-2 text-purple-500"></i>
                        캐릭터 레퍼런스
                    </h3>
                    <p class="text-xs md:text-base text-gray-600">
                        <i class="fas fa-info-circle mr-2"></i>
                        <span class="hidden sm:inline">각 캐릭터의 레퍼런스 이미지를 생성하면 삽화에서 일관된 모습을 유지할 수 있어요.</span>
                        <span class="sm:hidden">레퍼런스 이미지로 일관성 유지</span>
                    </p>
                    ${createModelSelect('character', imageSettings.characterModel || 'gemini-3-pro-image-preview', 'updateCharacterModel(this.value)')}
                </div>
                <div class="flex gap-2 md:gap-3">
                    <button 
                        onclick="generateAllCharacterReferences()"
                        class="bg-purple-600 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg hover:bg-purple-700 transition whitespace-nowrap text-sm md:text-base"
                    >
                        <i class="fas fa-images mr-1 md:mr-2"></i><span class="hidden sm:inline">모든 레퍼런스 생성</span><span class="sm:hidden">전체 생성</span>
                    </button>
                    <button 
                        onclick="downloadAllCharacterReferences()"
                        class="bg-blue-600 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg hover:bg-blue-700 transition whitespace-nowrap text-sm md:text-base"
                    >
                        <i class="fas fa-download mr-1 md:mr-2"></i><span class="hidden sm:inline">모두 다운로드</span><span class="sm:hidden">다운</span>
                    </button>
                    <button 
                        onclick="addNewCharacter()"
                        class="bg-green-600 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg hover:bg-green-700 transition whitespace-nowrap text-sm md:text-base"
                    >
                        <i class="fas fa-plus mr-1 md:mr-2"></i><span class="hidden sm:inline">캐릭터 추가</span><span class="sm:hidden">추가</span>
                    </button>
                </div>
            </div>
            <div id="character-section-content" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                ${storybook.characters.map((char, idx) => `
                    <div class="character-card card rounded-xl p-4 md:p-6">
                        <div class="flex justify-between items-start mb-3 md:mb-4">
                            <div class="flex-1">
                                <input 
                                    type="text" 
                                    id="char-name-${idx}" 
                                    value="${char.name}"
                                    onchange="updateCharacterName(${idx}, this.value)"
                                    class="text-lg md:text-2xl font-bold mb-2 bg-transparent border-b-2 border-white text-white placeholder-white w-full"
                                />
                                <div class="flex gap-2 items-center mb-2">
                                    <span class="bg-white text-purple-600 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-semibold">
                                        ${char.role}
                                    </span>
                                    <div class="flex items-center gap-1 bg-white bg-opacity-20 px-2 py-1 rounded">
                                        <i class="fas fa-ruler-vertical text-white text-xs"></i>
                                        <input 
                                            type="number" 
                                            id="char-height-${idx}" 
                                            value="${char.height || 150}"
                                            onchange="updateCharacterHeight(${idx}, this.value)"
                                            class="w-12 bg-transparent text-white text-xs font-semibold text-center border-b border-white focus:outline-none"
                                            min="50"
                                            max="250"
                                        />
                                        <span class="text-white text-xs">cm</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onclick="deleteCharacter(${idx})"
                                class="text-white hover:text-red-300 ml-2"
                            >
                                <i class="fas fa-trash text-sm md:text-base"></i>
                            </button>
                        </div>
                        <p class="text-white text-xs md:text-sm mb-3 md:mb-4 opacity-90">${char.description.substring(0, 80)}...</p>
                        <div id="char-ref-${idx}" class="mb-3 md:mb-4 min-h-[150px] md:min-h-[200px] bg-white bg-opacity-20 rounded-lg flex items-center justify-center overflow-hidden">
                            ${char.referenceImage ? 
                                `<img src="${char.referenceImage}" alt="${char.name}" class="w-full h-full object-cover rounded-lg"/>` :
                                '<p class="text-white text-xs md:text-sm text-center p-4">이미지 생성 대기중</p>'
                            }
                        </div>
                        ${char.referenceImage ? 
                            `<button 
                                onclick="downloadImage('${char.referenceImage}', '캐릭터_${char.name}.png')"
                                class="w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition mb-2"
                            >
                                <i class="fas fa-download mr-2"></i>이미지 다운로드
                            </button>` : ''
                        }
                        <textarea 
                            id="char-prompt-${idx}" 
                            class="w-full p-2 border border-white rounded-lg text-sm mb-2 bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-70"
                            rows="2"
                            placeholder="프롬프트를 수정하세요"
                        >${char.description}</textarea>
                        <div class="flex gap-2 mb-2">
                            <button 
                                onclick="generateCharacterReference(${idx})"
                                class="flex-1 bg-white text-purple-600 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition"
                            >
                                <i class="fas fa-image mr-2"></i>생성
                            </button>
                            <button 
                                onclick="document.getElementById('upload-char-${idx}').click()"
                                class="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition"
                            >
                                <i class="fas fa-upload mr-2"></i>업로드
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
                        <input 
                            type="file" 
                            id="upload-char-${idx}" 
                            accept="image/*" 
                            class="hidden" 
                            onchange="uploadCharacterImage(${idx}, this)"
                        />
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- 표지 생성 섹션 -->
        <div class="bg-white rounded-3xl shadow-2xl p-4 md:p-10 mb-8">
            <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-4 md:mb-6">
                <div class="flex-1">
                    <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2 cursor-pointer flex items-center" onclick="toggleSection('cover-section')">
                        <i id="cover-section-icon" class="fas fa-chevron-right mr-2 text-sm transition-transform"></i>
                        <i class="fas fa-book-open mr-2 text-indigo-500"></i>
                        표지 이미지
                    </h3>
                    <p class="text-xs md:text-base text-gray-600">
                        <i class="fas fa-info-circle mr-2"></i>
                        <span class="hidden sm:inline">동화책의 첫인상을 결정하는 표지 이미지를 생성하세요.</span>
                        <span class="sm:hidden">동화책 표지 생성</span>
                    </p>
                    ${createModelSelect('cover', imageSettings.coverModel || 'gemini-3-pro-image-preview', 'updateCoverModel(this.value)')}
                </div>
                <div class="flex gap-2 md:gap-3">
                    <button 
                        onclick="generateCoverImage()"
                        class="bg-indigo-600 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg hover:bg-indigo-700 transition whitespace-nowrap text-sm md:text-base"
                    >
                        <i class="fas fa-image mr-1 md:mr-2"></i><span class="hidden sm:inline">${storybook.coverImage ? '표지 재생성' : '표지 생성'}</span><span class="sm:hidden">${storybook.coverImage ? '재생성' : '생성'}</span>
                    </button>
                    ${storybook.coverImage ? `
                    <button 
                        onclick="downloadImage('${storybook.coverImage}', '${storybook.title}_표지.png')"
                        class="bg-green-600 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg hover:bg-green-700 transition whitespace-nowrap text-sm md:text-base"
                    >
                        <i class="fas fa-download mr-1 md:mr-2"></i><span class="hidden sm:inline">다운로드</span><span class="sm:hidden">다운</span>
                    </button>
                    ` : ''}
                </div>
            </div>
            <div id="cover-section-content" class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 hidden">
                <!-- 표지 이미지 -->
                <div class="card rounded-xl p-4 md:p-6 bg-gradient-to-br from-indigo-500 to-purple-600">
                    <h4 class="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">
                        <i class="fas fa-image mr-2"></i>표지 이미지
                    </h4>
                    <div id="cover-image-display" class="mb-3 md:mb-4 min-h-[300px] md:min-h-[400px] bg-white bg-opacity-20 rounded-lg flex items-center justify-center overflow-hidden">
                        ${storybook.coverImage ? 
                            `<img src="${storybook.coverImage}" alt="표지" class="w-full h-full object-cover rounded-lg"/>` :
                            '<div class="text-center p-6"><i class="fas fa-book-open text-6xl text-white opacity-50 mb-4"></i><p class="text-white text-sm">표지 이미지 생성 대기중</p></div>'
                        }
                    </div>
                </div>
                
                <!-- 표지 프롬프트 및 설정 -->
                <div class="space-y-4">
                    <div class="bg-gray-50 rounded-xl p-4 md:p-6">
                        <h4 class="text-lg font-bold text-gray-800 mb-3">
                            <i class="fas fa-edit mr-2"></i>표지 프롬프트
                        </h4>
                        <textarea 
                            id="cover-prompt" 
                            class="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            rows="6"
                            placeholder="표지 이미지 프롬프트를 작성하세요..."
                        >${storybook.coverPrompt || buildCoverPrompt(storybook)}</textarea>
                        <button 
                            onclick="resetCoverPrompt()"
                            class="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                        >
                            <i class="fas fa-redo mr-1"></i>기본 프롬프트로 초기화
                        </button>
                    </div>
                    
                    <div class="bg-gray-50 rounded-xl p-4 md:p-6">
                        <h4 class="text-lg font-bold text-gray-800 mb-3">
                            <i class="fas fa-users mr-2"></i>참조할 캐릭터 선택
                        </h4>
                        <div class="space-y-2 max-h-64 overflow-y-auto pr-2" style="scrollbar-width: thin;">
                            ${storybook.characters.map((char, idx) => `
                                <label class="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        id="cover-char-ref-${idx}"
                                        ${storybook.coverCharacterRefs && storybook.coverCharacterRefs.includes(idx) ? 'checked' : ''}
                                        onchange="toggleCoverCharacterRef(${idx}, this.checked)"
                                        class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <div class="flex items-center gap-2 flex-1">
                                        ${char.referenceImage ? 
                                            `<img src="${char.referenceImage}" class="w-10 h-10 rounded object-cover" />` :
                                            `<div class="w-10 h-10 rounded bg-gray-200 flex items-center justify-center"><i class="fas fa-user text-gray-400"></i></div>`
                                        }
                                        <span class="text-sm font-medium">${char.name}</span>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                        ${storybook.characters.length > 4 ? `<p class="text-xs text-gray-500 mt-2"><i class="fas fa-info-circle mr-1"></i>스크롤하여 더 많은 캐릭터 보기</p>` : ''}
                    </div>
                </div>
            </div>
        </div>

        <!-- Key Objects 섹션 -->
        <div class="bg-white rounded-3xl shadow-2xl p-4 md:p-10 mb-8">
            <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-4 md:mb-6">
                <div class="flex-1">
                    <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2 cursor-pointer flex items-center" onclick="toggleSection('keyobject-section')">
                        <i id="keyobject-section-icon" class="fas fa-chevron-right mr-2 text-sm transition-transform"></i>
                        <i class="fas fa-cube mr-2 text-orange-500"></i>
                        핵심 사물 (Key Objects)
                    </h3>
                    <p class="text-xs md:text-base text-gray-600">
                        <i class="fas fa-info-circle mr-2"></i>
                        <span class="hidden sm:inline">스토리에서 중요한 물건들을 미리 생성하면 삽화에서 일관되게 표현할 수 있어요.</span>
                        <span class="sm:hidden">핵심 사물로 일관성 유지</span>
                    </p>
                    ${createModelSelect('keyobject', imageSettings.keyObjectModel || 'gemini-3-pro-image-preview', 'updateKeyObjectModel(this.value)')}
                </div>
                <div class="flex gap-2 md:gap-3">
                    <button 
                        onclick="generateAllKeyObjectImages()"
                        class="bg-orange-600 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg hover:bg-orange-700 transition whitespace-nowrap text-sm md:text-base"
                    >
                        <i class="fas fa-images mr-1 md:mr-2"></i><span class="hidden sm:inline">모든 이미지 생성</span><span class="sm:hidden">전체 생성</span>
                    </button>
                    <button 
                        onclick="downloadAllKeyObjectImages()"
                        class="bg-green-600 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg hover:bg-green-700 transition whitespace-nowrap text-sm md:text-base"
                    >
                        <i class="fas fa-download mr-1 md:mr-2"></i><span class="hidden sm:inline">모두 다운로드</span><span class="sm:hidden">다운</span>
                    </button>
                    <button 
                        onclick="addNewKeyObject()"
                        class="bg-blue-600 text-white px-3 md:px-6 py-2 md:py-3 rounded-lg hover:bg-blue-700 transition whitespace-nowrap text-sm md:text-base"
                    >
                        <i class="fas fa-plus mr-1 md:mr-2"></i><span class="hidden sm:inline">사물 추가</span><span class="sm:hidden">추가</span>
                    </button>
                </div>
            </div>

            <div id="keyobject-section-content" class="hidden">
            ${storybook.key_objects && storybook.key_objects.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                ${storybook.key_objects.map((obj, idx) => {
                    const objImg = storybook.keyObjectImages && storybook.keyObjectImages[idx];
                    const sizeIcon = obj.size === 'small' ? 'fa-hand-holding' : obj.size === 'large' ? 'fa-building' : 'fa-box';
                    const sizeColor = obj.size === 'small' ? 'text-blue-600' : obj.size === 'large' ? 'text-red-600' : 'text-yellow-600';
                    return `
                    <div class="bg-gradient-to-br from-orange-50 to-yellow-50 p-4 rounded-xl border-2 border-orange-200">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <input 
                                        type="text" 
                                        id="keyobj-name-${idx}" 
                                        value="${obj.name}"
                                        onblur="updateKeyObjectField(${idx}, 'name', this.value)"
                                        class="font-bold text-gray-700 bg-transparent border-b border-orange-300 focus:border-orange-500 focus:outline-none w-full"
                                        placeholder="영어 이름"
                                    />
                                    <i class="${sizeIcon} ${sizeColor}" title="${obj.size}"></i>
                                </div>
                                <input 
                                    type="text" 
                                    id="keyobj-korean-${idx}" 
                                    value="${obj.korean}"
                                    onblur="updateKeyObjectField(${idx}, 'korean', this.value)"
                                    class="text-sm text-gray-600 bg-transparent border-b border-orange-200 focus:border-orange-400 focus:outline-none w-full mb-2"
                                    placeholder="한글 이름"
                                />
                                <div class="flex items-center gap-2 mb-2">
                                    <select 
                                        id="keyobj-size-${idx}"
                                        onchange="updateKeyObjectField(${idx}, 'size', this.value)"
                                        class="flex-1 text-xs bg-white border border-orange-200 rounded px-2 py-1"
                                    >
                                        <option value="small" ${obj.size === 'small' ? 'selected' : ''}>Small</option>
                                        <option value="medium" ${obj.size === 'medium' ? 'selected' : ''}>Medium</option>
                                        <option value="large" ${obj.size === 'large' ? 'selected' : ''}>Large</option>
                                    </select>
                                    <div class="flex items-center gap-1">
                                        <input 
                                            type="number" 
                                            id="keyobj-size-cm-${idx}" 
                                            value="${obj.sizeCm || (obj.size === 'small' ? 10 : obj.size === 'large' ? 200 : 100)}"
                                            onblur="updateKeyObjectField(${idx}, 'sizeCm', parseInt(this.value))"
                                            class="w-12 text-xs bg-white border border-orange-200 rounded px-1 py-1 text-center"
                                            min="1"
                                            max="1000"
                                        />
                                        <span class="text-xs text-gray-600">cm</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onclick="deleteKeyObject(${idx})"
                                class="text-orange-600 hover:text-red-600 ml-2"
                                title="삭제"
                            >
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        
                        <div class="mb-2">
                            <label class="text-xs text-gray-500 block mb-1">설명 (시각적 상세):</label>
                            <textarea 
                                id="keyobj-description-${idx}" 
                                onblur="updateKeyObjectField(${idx}, 'description', this.value)"
                                class="text-xs text-gray-700 bg-white border border-orange-200 rounded p-2 focus:border-orange-400 focus:outline-none w-full"
                                placeholder="색상, 재질, 모양, 크기, 특징..."
                                rows="3"
                            >${obj.description}</textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label class="text-xs text-gray-500 block mb-1">예시 문장:</label>
                            <input 
                                type="text" 
                                id="keyobj-example-${idx}" 
                                value="${obj.example || ''}"
                                onblur="updateKeyObjectField(${idx}, 'example', this.value)"
                                class="text-xs text-blue-700 bg-blue-50 border border-orange-200 rounded px-2 py-1 focus:border-orange-400 focus:outline-none w-full"
                                placeholder="이 사물이 등장하는 문장"
                            />
                        </div>
                        
                        <div id="keyobj-img-${idx}" class="bg-white rounded-lg mb-2 min-h-[180px] flex items-center justify-center overflow-hidden border-2 border-orange-200">
                            ${objImg && objImg.imageUrl ? 
                                `<img src="${objImg.imageUrl}" alt="${obj.name}" class="w-full h-full object-cover rounded-lg"/>` :
                                `<p class="text-gray-400 text-sm text-center p-4">
                                    <i class="fas fa-cube text-3xl mb-2"></i><br>
                                    이미지 대기중
                                </p>`
                            }
                        </div>
                        
                        <button 
                            onclick="generateSingleKeyObjectImage(${idx})"
                            class="w-full bg-orange-500 text-white px-2 py-2 rounded text-sm hover:bg-orange-600 transition"
                        >
                            <i class="fas fa-magic mr-1"></i>${objImg && objImg.imageUrl ? '재생성' : '이미지 생성'}
                        </button>
                    </div>
                    `;
                }).join('')}
            </div>
            ` : `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-cube text-5xl mb-3"></i>
                <p class="text-lg">아직 핵심 사물이 없습니다.</p>
                <p class="text-sm mt-2">"사물 추가" 버튼을 눌러 핵심 사물을 추가하세요.</p>
            </div>
            `}
            </div>
        </div>

        <!-- 페이지 섹션 -->
        <div class="bg-white rounded-3xl shadow-2xl p-10 mb-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-3xl font-bold text-gray-800 cursor-pointer flex items-center" onclick="toggleSection('pages-section')">
                    <i id="pages-section-icon" class="fas fa-chevron-down mr-2 text-sm transition-transform"></i>
                    <i class="fas fa-book mr-2 text-purple-500"></i>
                    스토리 페이지 (${storybook.pages.length}페이지)
                </h3>
                <div class="mb-3 flex items-center gap-4 flex-wrap">
                    <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-600">이미지 모델:</label>
                        ${createModelSelect('illustration', imageSettings.illustrationModel || 'gemini-3-pro-image-preview')}
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-600">번역 언어:</label>
                        <select id="translationLanguage" class="border border-gray-300 rounded px-3 py-1.5 text-sm">
                            <option value="en">English</option>
                            <option value="ja">日本語</option>
                            <option value="zh">中文</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="vi">Tiếng Việt</option>
                            <option value="th">ไทย</option>
                        </select>
                        <button 
                            onclick="translateAllText()"
                            class="bg-teal-600 text-white px-4 py-1.5 rounded hover:bg-teal-700 transition text-sm"
                        >
                            <i class="fas fa-language mr-1"></i>번역
                        </button>
                    </div>
                </div>
                <div class="flex gap-3 flex-wrap">
                    <div class="flex gap-2">
                        <div class="relative inline-flex">
                            <button 
                                onclick="generateAllIllustrationsParallel()"
                                class="bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition shadow-md"
                            >
                                <i class="fas fa-bolt mr-2"></i>모든 삽화 생성 (빠르게)
                            </button>
                            <button 
                                onclick="showGenerationModeHelp('parallel')"
                                class="absolute -top-2 -right-2 bg-white text-blue-600 w-6 h-6 rounded-full hover:bg-blue-50 transition shadow-md flex items-center justify-center"
                                title="병렬 생성 모드에 대한 자세한 설명 보기"
                            >
                                <i class="fas fa-question text-xs"></i>
                            </button>
                        </div>
                        <div class="relative inline-flex">
                            <button 
                                onclick="generateAllIllustrationsSequential()"
                                class="bg-indigo-600 text-white px-5 py-3 rounded-lg hover:bg-indigo-700 transition shadow-md"
                            >
                                <i class="fas fa-layer-group mr-2"></i>모든 삽화 생성 (정확하게)
                            </button>
                            <button 
                                onclick="showGenerationModeHelp('sequential')"
                                class="absolute -top-2 -right-2 bg-white text-indigo-600 w-6 h-6 rounded-full hover:bg-indigo-50 transition shadow-md flex items-center justify-center"
                                title="순차 생성 모드에 대한 자세한 설명 보기"
                            >
                                <i class="fas fa-question text-xs"></i>
                            </button>
                        </div>
                    </div>
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
                    <button 
                        onclick="downloadAllAudio()"
                        class="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition"
                    >
                        <i class="fas fa-volume-up mr-2"></i>전체 MP3
                    </button>
                </div>
            </div>

            <div id="pages-section-content" class="space-y-6">
                ${storybook.pages.map((page, idx) => `
                    <div class="page-card">
                        <h4 class="text-xl md:text-2xl font-bold text-purple-600 mb-3 md:mb-4">페이지 ${page.pageNumber}</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div>
                                <h5 class="font-bold text-gray-700 mb-2 text-sm md:text-base">텍스트</h5>
                                <textarea 
                                    id="text-${idx}" 
                                    class="w-full p-3 md:p-4 border-2 border-gray-300 rounded-lg mb-3 md:mb-4 text-sm md:text-base"
                                    rows="3"
                                    onchange="updatePageText(${idx}, this.value)"
                                >${page.text}</textarea>

                                <h5 class="font-bold text-gray-700 mb-2 text-sm md:text-base">장면 전체 설명 (통합)</h5>
                                <textarea 
                                    id="scene-combined-${idx}" 
                                    class="w-full p-2 md:p-3 border-2 border-gray-300 rounded-lg text-xs md:text-sm mb-2"
                                    rows="5"
                                    placeholder="장면 설명, 캐릭터, 배경, 분위기를 모두 포함하여 작성하세요"
                                    onblur="updateSceneCombined(${idx}, this.value)"
                                >${page.scene_description || ''}${page.scene_structure ? '\n\n캐릭터: ' + (page.scene_structure.characters || '') + '\n배경: ' + (page.scene_structure.background || '') + '\n분위기: ' + (page.scene_structure.atmosphere || '') : ''}</textarea>
                                
                                <h5 class="font-bold text-gray-700 mb-2 mt-3 text-sm md:text-base">그림체</h5>
                                <input 
                                    id="artstyle-${idx}" 
                                    value="${page.artStyle || storybook.artStyle}"
                                    placeholder="그림체 (예: 현대 일러스트레이션)"
                                    class="w-full p-2 border-2 border-gray-300 rounded-lg text-xs md:text-sm mb-2"
                                />
                                
                                <!-- TTS 섹션 -->
                                <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h5 class="font-bold text-gray-700 mb-2 text-sm md:text-base flex items-center">
                                        <i class="fas fa-volume-up mr-2 text-blue-600"></i>음성(TTS)
                                    </h5>
                                    
                                    <div class="space-y-2">
                                        <!-- TTS 설정 -->
                                        <div class="flex flex-col sm:flex-row gap-2">
                                            <div class="flex-1">
                                                <label class="text-xs text-gray-600 block mb-1">
                                                    음성 설정 
                                                    <span class="text-gray-400 ml-1" title="성별, 톤, 속도, 스타일 등을 자유롭게 입력하세요">ℹ️</span>
                                                </label>
                                                <input 
                                                    id="tts-config-${idx}" 
                                                    value="${page.ttsConfig || imageSettings.ttsVoiceConfig}"
                                                    placeholder="예: 여성 목소리, 동화 낭독 스타일, 또박또박"
                                                    class="w-full p-2 border border-gray-300 rounded text-xs"
                                                    onblur="updateTTSConfig(${idx}, this.value)"
                                                />
                                                <p class="text-xs text-gray-500 mt-1">
                                                    💡 예시: "남성, 깊고 차분한 목소리" / "어린이 목소리, 밝고 경쾌하게"
                                                </p>
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-600 block mb-1">모델</label>
                                                ${createTTSModelSelect(page.ttsModel || imageSettings.ttsModel, idx)}
                                            </div>
                                        </div>
                                        
                                        <!-- TTS 생성 버튼 -->
                                        <button 
                                            onclick="generatePageTTS(${idx})"
                                            class="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition text-sm"
                                            id="tts-btn-${idx}"
                                        >
                                            <i class="fas fa-microphone mr-2"></i>${page.audioUrl ? 'TTS 재생성' : 'TTS 생성'}
                                        </button>
                                        
                                        <!-- TTS 플레이어 -->
                                        ${page.audioUrl ? `
                                        <div class="space-y-2">
                                            <audio controls class="w-full" id="audio-player-${idx}">
                                                <source src="${page.audioUrl}" type="audio/mpeg">
                                                브라우저가 오디오를 지원하지 않습니다.
                                            </audio>
                                            <button 
                                                onclick="downloadAudio('${page.audioUrl}', '${storybook.title}_페이지_${page.pageNumber}.mp3')"
                                                class="w-full bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition text-xs"
                                            >
                                                <i class="fas fa-download mr-1"></i>MP3 다운로드
                                            </button>
                                        </div>
                                        ` : `<p class="text-xs text-gray-500 text-center py-2">TTS 생성 버튼을 클릭하세요</p>`}
                                    </div>
                                </div>

                                <button 
                                    onclick="generateIllustration(${idx})"
                                    class="w-full mt-2 bg-blue-600 text-white py-2 md:py-2 rounded-lg font-semibold hover:bg-blue-700 transition text-sm md:text-base"
                                >
                                    <i class="fas fa-paint-brush mr-2"></i>${page.illustrationImage ? '삽화 재생성' : '삽화 생성'}
                                </button>
                            </div>

                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <h5 class="font-bold text-gray-700 text-sm md:text-base">삽화</h5>
                                    ${page.illustrationImage ?
                                        `<button 
                                            onclick="downloadImage('${page.illustrationImage}', '${storybook.title}_페이지_${page.pageNumber}.png')"
                                            class="bg-green-600 text-white px-2 md:px-3 py-1 rounded-lg hover:bg-green-700 transition text-xs md:text-sm"
                                        >
                                            <i class="fas fa-download mr-1"></i>다운로드
                                        </button>` : ''
                                    }
                                </div>
                                <div id="illustration-${idx}" class="bg-gray-100 rounded-lg min-h-[200px] md:min-h-[300px] flex items-center justify-center overflow-hidden">
                                    ${page.illustrationImage ?
                                        `<img src="${page.illustrationImage}" alt="Page ${page.pageNumber}" class="w-full h-full object-cover rounded-lg"/>` :
                                        `<p class="text-gray-500 text-center p-4 text-sm md:text-base">
                                            <i class="fas fa-image text-3xl md:text-4xl mb-2"></i><br>
                                            삽화 생성 버튼을 클릭하세요
                                        </p>`
                                    }
                                </div>
                                
                                ${page.illustrationImage ? `
                                <div class="mt-3">
                                    <label class="block text-xs md:text-sm font-semibold text-gray-700 mb-1">
                                        <i class="fas fa-edit mr-1"></i>이미지 수정사항 (선택사항)
                                    </label>
                                    <textarea 
                                        id="edit-note-${idx}" 
                                        class="w-full p-2 border-2 border-yellow-300 rounded-lg text-xs md:text-sm"
                                        rows="2"
                                        placeholder="수정할 내용을 입력하세요 (예: 토끼를 더 크게 그려주세요, 배경을 밝게 해주세요)"
                                    >${page.editNote || ''}</textarea>
                                    <p class="text-xs text-gray-500 mt-1">
                                        <i class="fas fa-info-circle mr-1"></i>
                                        수정사항을 입력하고 '삽화 재생성' 버튼을 누르면 반영됩니다.
                                    </p>
                                </div>
                                ` : ''}
                                
                                <div class="mt-3">
                                    <label class="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-images mr-1"></i>참조할 다른 페이지 이미지 (선택사항)
                                    </label>
                                    <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 bg-gray-50">
                                        ${storybook.pages.map((p, pIdx) => {
                                            if (pIdx === idx || !p.illustrationImage) return '';
                                            return `
                                            <div class="relative group cursor-pointer" onclick="toggleReferenceImage(${idx}, ${pIdx})">
                                                <img 
                                                    src="${p.illustrationImage}" 
                                                    alt="페이지 ${p.pageNumber}"
                                                    class="w-full h-16 sm:h-20 object-cover rounded border-2 border-gray-300 hover:border-blue-500 transition"
                                                    id="ref-img-${idx}-${pIdx}"
                                                />
                                                <div class="absolute top-0 right-0 bg-blue-600 text-white text-xs px-1 sm:px-1.5 py-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition">
                                                    ${p.pageNumber}
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    id="ref-check-${idx}-${pIdx}"
                                                    class="absolute top-1 left-1 w-3 h-3 sm:w-4 sm:h-4"
                                                />
                                            </div>
                                            `;
                                        }).join('') || '<p class="text-gray-400 text-xs col-span-3 sm:col-span-4 text-center py-4">아직 다른 페이지에 이미지가 없습니다.<br>먼저 다른 페이지의 삽화를 생성해주세요.</p>'}
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">
                                        <i class="fas fa-lightbulb mr-1"></i>
                                        참조할 이미지를 클릭하면 선택됩니다. 선택한 이미지의 스타일, 색감, 구도를 참고하여 생성합니다.
                                    </p>
                                </div>
                                
                                ${storybook.key_objects && storybook.key_objects.length > 0 ? `
                                <div class="mt-3">
                                    <label class="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-cube mr-1"></i>참조할 Key Objects (선택사항)
                                    </label>
                                    <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto border border-orange-300 rounded-lg p-2 bg-orange-50">
                                        ${storybook.key_objects.map((obj, objIdx) => {
                                            const objImg = storybook.keyObjectImages && storybook.keyObjectImages[objIdx];
                                            if (!objImg || !objImg.imageUrl) return '';
                                            return `
                                            <div class="relative group cursor-pointer" onclick="toggleKeyObjectReference(${idx}, ${objIdx})">
                                                <img 
                                                    src="${objImg.imageUrl}" 
                                                    alt="${obj.korean}"
                                                    class="w-full h-16 sm:h-20 object-cover rounded border-2 border-orange-300 hover:border-orange-500 transition"
                                                    id="ref-keyobj-${idx}-${objIdx}"
                                                />
                                                <div class="absolute top-0 right-0 bg-orange-600 text-white text-xs px-1 sm:px-1.5 py-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition">
                                                    ${obj.korean}
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    id="ref-keyobj-check-${idx}-${objIdx}"
                                                    class="absolute top-1 left-1 w-3 h-3 sm:w-4 sm:h-4"
                                                />
                                            </div>
                                            `;
                                        }).join('') || '<p class="text-gray-400 text-xs col-span-3 sm:col-span-4 text-center py-4">아직 Key Object 이미지가 없습니다.<br>먼저 Key Objects 이미지를 생성해주세요.</p>'}
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">
                                        <i class="fas fa-lightbulb mr-1"></i>
                                        이 페이지에 등장하는 Key Objects를 선택하면 일관성있는 사물 표현이 가능합니다.
                                    </p>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>



        <!-- 교육 콘텐츠 -->
        <div class="bg-white rounded-3xl shadow-2xl p-4 md:p-10">
            <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6 cursor-pointer flex items-center" onclick="toggleSection('education-section')"><i id="education-section-icon" class="fas fa-chevron-down mr-2 text-sm transition-transform"></i>
                <i class="fas fa-graduation-cap mr-2 text-purple-500"></i>
                교육 콘텐츠
            </h3>

            <div id="education-section-content" class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
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

                <div class="bg-blue-50 p-6 rounded-xl col-span-3">
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex-1">
                            <h4 class="text-xl font-bold text-blue-600 mb-2">
                                <i class="fas fa-language mr-2"></i>영어 단어 학습 (${storybook.educational_content.vocabulary.length}개)
                            </h4>
                            ${createModelSelect('vocabulary', imageSettings.vocabularyModel || 'gemini-3-pro-image-preview', 'updateVocabularyModel(this.value)')}
                        </div>
                        <div class="flex gap-2">
                            <button 
                                onclick="generateAllVocabularyImages()"
                                class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
                            >
                                <i class="fas fa-images mr-1"></i>모든 이미지 생성
                            </button>
                            <button 
                                onclick="downloadAllVocabularyImages()"
                                class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                            >
                                <i class="fas fa-download mr-1"></i>이미지 다운로드
                            </button>
                            <button 
                                onclick="downloadVocabularyTxt()"
                                class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm"
                            >
                                <i class="fas fa-file-alt mr-1"></i>TXT 다운로드
                            </button>
                        </div>
                    </div>
                    
                    <div class="grid md:grid-cols-4 gap-4">
                        ${storybook.educational_content.vocabulary.map((vocabItem, idx) => {
                            // vocabulary가 객체 형식인지 문자열인지 확인
                            const word = typeof vocabItem === 'object' ? vocabItem.word : vocabItem;
                            const korean = typeof vocabItem === 'object' ? vocabItem.korean : '';
                            const definition = typeof vocabItem === 'object' ? vocabItem.definition : '';
                            const example = typeof vocabItem === 'object' ? vocabItem.example : '';
                            const vocabImg = storybook.vocabularyImages && storybook.vocabularyImages[idx];
                            return `
                            <div class="bg-white p-4 rounded-lg border-2 border-blue-200">
                                <div class="flex justify-between items-center mb-2">
                                    <div class="flex-1">
                                        <input 
                                            type="text" 
                                            id="vocab-word-${idx}" 
                                            value="${word}"
                                            onchange="updateVocabularyWord(${idx}, this.value, 'word')"
                                            class="font-bold text-gray-700 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none w-full mb-1"
                                            placeholder="영어 단어"
                                        />
                                        ${korean ? `
                                        <input 
                                            type="text" 
                                            id="vocab-korean-${idx}" 
                                            value="${korean}"
                                            onchange="updateVocabularyWord(${idx}, this.value, 'korean')"
                                            class="text-sm text-gray-500 bg-transparent border-b border-gray-200 focus:border-blue-400 focus:outline-none w-full mb-2"
                                            placeholder="한글 뜻"
                                        />` : ''}
                                        ${definition ? `
                                        <div class="mt-2">
                                            <label class="text-xs text-gray-400 block mb-1">설명:</label>
                                            <textarea 
                                                id="vocab-definition-${idx}" 
                                                onchange="updateVocabularyWord(${idx}, this.value, 'definition')"
                                                class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2 focus:border-blue-400 focus:outline-none w-full"
                                                placeholder="단어 설명"
                                                rows="2"
                                            >${definition}</textarea>
                                        </div>` : ''}
                                        ${example ? `
                                        <div class="mt-2">
                                            <label class="text-xs text-gray-400 block mb-1">예문:</label>
                                            <input 
                                                type="text" 
                                                id="vocab-example-${idx}" 
                                                value="${example}"
                                                onchange="updateVocabularyWord(${idx}, this.value, 'example')"
                                                class="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1 focus:border-blue-400 focus:outline-none w-full"
                                                placeholder="예문"
                                            />
                                        </div>` : ''}
                                    </div>
                                    ${vocabImg && vocabImg.imageUrl ? 
                                        `<button 
                                            onclick="downloadImage('${vocabImg.imageUrl}', '단어_${word}.png')"
                                            class="text-green-600 hover:text-green-800 ml-2"
                                            title="다운로드"
                                        >
                                            <i class="fas fa-download"></i>
                                        </button>` : ''
                                    }
                                </div>
                                <div id="vocab-img-${idx}" class="bg-gray-100 rounded-lg mb-2 min-h-[180px] flex items-center justify-center overflow-hidden">
                                    ${vocabImg && vocabImg.imageUrl ? 
                                        `<img src="${vocabImg.imageUrl}" alt="${word}" class="w-full h-full object-cover rounded-lg"/>` :
                                        `<p class="text-gray-400 text-sm text-center p-4">
                                            <i class="fas fa-image text-3xl mb-2"></i><br>
                                            이미지 대기중
                                        </p>`
                                    }
                                </div>
                                <div class="flex gap-2">
                                    <button 
                                        onclick="generateSingleVocabularyImage(${idx})"
                                        class="flex-1 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition"
                                    >
                                        <i class="fas fa-magic mr-1"></i>${vocabImg && vocabImg.imageUrl ? '재생성' : '생성'}
                                    </button>
                                    ${vocabImg && vocabImg.imageUrl ? 
                                        `<button 
                                            onclick="downloadImage('${vocabImg.imageUrl}', '단어_${word}.png')"
                                            class="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition"
                                            title="다운로드"
                                        >
                                            <i class="fas fa-download"></i>
                                        </button>` : ''
                                    }
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <!-- 퀴즈 섹션 -->
                <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 shadow-lg border-2 border-purple-200">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-xl font-bold text-purple-800">
                            <i class="fas fa-question-circle mr-2"></i>독해 퀴즈
                            ${storybook.quizzes && storybook.quizzes.length > 0 ? ` (${storybook.quizzes.length}개)` : ''}
                        </h4>
                        <button 
                            onclick="generateQuiz()"
                            class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm"
                        >
                            <i class="fas fa-plus mr-1"></i>퀴즈 ${storybook.quizzes && storybook.quizzes.length > 0 ? '더 ' : ''}만들기
                        </button>
                    </div>
                    
                    <div id="quiz-container" class="space-y-4">
                        ${storybook.quizzes && storybook.quizzes.length > 0 ? 
                            storybook.quizzes.map((quiz, qIdx) => `
                            <div class="bg-white p-5 rounded-lg border-2 border-purple-200 shadow-sm">
                                <div class="flex justify-between items-start mb-3">
                                    <h5 class="font-bold text-gray-800 flex-1">
                                        <span class="inline-block bg-purple-500 text-white rounded-full w-7 h-7 text-center leading-7 text-sm mr-2">
                                            ${qIdx + 1}
                                        </span>
                                        ${quiz.question}
                                    </h5>
                                    <button 
                                        onclick="deleteQuiz(${qIdx})"
                                        class="text-red-500 hover:text-red-700 ml-2"
                                        title="삭제"
                                    >
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                                
                                <div class="space-y-2 mb-3">
                                    ${quiz.options.map((option, oIdx) => `
                                    <div class="flex items-start p-3 rounded-lg ${oIdx === quiz.answer ? 'bg-green-50 border-2 border-green-400' : 'bg-gray-50 border border-gray-200'} cursor-pointer hover:bg-opacity-80 transition"
                                         onclick="showQuizAnswer(${qIdx})">
                                        <span class="inline-block ${oIdx === quiz.answer ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'} rounded-full w-6 h-6 text-center leading-6 text-sm mr-3 flex-shrink-0">
                                            ${oIdx + 1}
                                        </span>
                                        <span class="${oIdx === quiz.answer ? 'font-semibold text-green-800' : 'text-gray-700'}">
                                            ${option}
                                            ${oIdx === quiz.answer ? '<i class="fas fa-check-circle ml-2 text-green-600"></i>' : ''}
                                        </span>
                                    </div>
                                    `).join('')}
                                </div>
                                
                                <div id="quiz-explanation-${qIdx}" class="hidden mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                    <p class="text-sm text-blue-800">
                                        <i class="fas fa-lightbulb mr-1"></i>
                                        <strong>정답 설명:</strong> ${quiz.explanation}
                                    </p>
                                </div>
                            </div>
                            `).join('') 
                        : 
                            `<div class="text-center py-8 text-gray-500">
                                <i class="fas fa-question-circle text-4xl mb-3"></i>
                                <p>아직 퀴즈가 없습니다.</p>
                                <p class="text-sm mt-1">위의 "퀴즈 만들기" 버튼을 눌러 퀴즈를 생성하세요.</p>
                            </div>`
                        }
                    </div>
                </div>
            </div>
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

function updateCharacterHeight(charIndex, height) {
    const heightNum = parseInt(height);
    if (heightNum >= 50 && heightNum <= 250) {
        currentStorybook.characters[charIndex].height = heightNum;
        saveCurrentStorybook();
        console.log(`✅ Character height updated: ${currentStorybook.characters[charIndex].name} = ${heightNum}cm`);
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
    
    const heightStr = prompt('캐릭터 키를 입력하세요 (cm, 50-250):', '150');
    const height = parseInt(heightStr) || 150;
    
    const newCharacter = {
        name: name.trim(),
        description: description.trim(),
        role: role ? role.trim() : '기타',
        height: Math.max(50, Math.min(250, height)),
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

// 장면 통합 설명 업데이트
function updateSceneCombined(pageIndex, combinedText) {
    if (!combinedText || !combinedText.trim()) return;
    
    const text = combinedText.trim();
    currentStorybook.pages[pageIndex].scene_description = text;
    
    // scene_structure는 더 이상 별도로 관리하지 않음
    // 모든 정보를 scene_description에 통합
    saveCurrentStorybook();
    console.log(`✅ 페이지 ${pageIndex + 1} 장면 설명 업데이트됨`);
}

// TTS 설정 업데이트
function updateTTSConfig(pageIndex, config) {
    if (!config || !config.trim()) return;
    
    currentStorybook.pages[pageIndex].ttsConfig = config.trim();
    saveCurrentStorybook();
    console.log(`✅ 페이지 ${pageIndex + 1} TTS 설정 업데이트: ${config}`);
}

// TTS 모델 업데이트
function updateTTSModel(value) {
    imageSettings.ttsModel = value;
    saveImageSettings();
    console.log('✅ TTS 모델 변경:', value);
}

// 페이지별 TTS 모델 업데이트
function updatePageTTSModel(pageIndex, value) {
    currentStorybook.pages[pageIndex].ttsModel = value;
    saveCurrentStorybook();
    console.log(`✅ 페이지 ${pageIndex + 1} TTS 모델 변경:`, value);
}

// 페이지 TTS 생성
async function generatePageTTS(pageIndex) {
    const page = currentStorybook.pages[pageIndex];
    const btnId = `tts-btn-${pageIndex}`;
    const btn = document.getElementById(btnId);
    
    if (!page.text || !page.text.trim()) {
        alert('텍스트가 없습니다. 먼저 텍스트를 입력해주세요.');
        return;
    }
    
    // 버튼 비활성화 및 로딩 표시
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>TTS 생성 중...';
    
    try {
        const ttsConfig = page.ttsConfig || imageSettings.ttsVoiceConfig;
        const ttsModel = page.ttsModel || imageSettings.ttsModel;
        
        console.log(`🎙️ TTS 생성 시작 - 페이지 ${pageIndex + 1}:`, {
            text: page.text,
            config: ttsConfig,
            model: ttsModel
        });
        
        // API 호출
        const response = await fetch('/api/generate-tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': localStorage.getItem('API_KEY') || ''
            },
            body: JSON.stringify({
                text: page.text,
                voiceConfig: ttsConfig,
                model: ttsModel
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'TTS 생성 실패');
        }
        
        const data = await response.json();
        
        if (data.success && data.audioUrl) {
            // 페이지에 오디오 URL 저장
            currentStorybook.pages[pageIndex].audioUrl = data.audioUrl;
            currentStorybook.pages[pageIndex].ttsConfig = ttsConfig;
            currentStorybook.pages[pageIndex].ttsModel = ttsModel;
            saveCurrentStorybook();
            
            // UI 업데이트
            displayStorybook(currentStorybook);
            
            showNotification('success', 'TTS 생성 완료!', `페이지 ${pageIndex + 1}의 음성이 생성되었습니다.`);
        } else {
            throw new Error(data.error || 'TTS URL을 받지 못했습니다.');
        }
        
    } catch (error) {
        console.error('TTS 생성 오류:', error);
        alert('TTS 생성 실패: ' + error.message);
        
        // 버튼 복구
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-microphone mr-2"></i>${page.audioUrl ? 'TTS 재생성' : 'TTS 생성'}`;
    }
}

// 오디오 다운로드
async function downloadAudio(audioUrl, filename) {
    try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('success', '다운로드 완료', filename + '이 다운로드되었습니다.');
    } catch (error) {
        console.error('다운로드 오류:', error);
        alert('다운로드 실패: ' + error.message);
    }
}

// 모든 MP3 다운로드
async function downloadAllAudio() {
    if (!currentStorybook || !currentStorybook.pages) {
        alert('동화책이 선택되지 않았습니다.');
        return;
    }
    
    const pagesWithAudio = currentStorybook.pages.filter(page => page.audioUrl);
    
    if (pagesWithAudio.length === 0) {
        alert('생성된 TTS가 없습니다. 먼저 TTS를 생성해주세요.');
        return;
    }
    
    if (!confirm(`${pagesWithAudio.length}개의 MP3 파일을 다운로드하시겠습니까?`)) {
        return;
    }
    
    let downloadCount = 0;
    
    for (let i = 0; i < pagesWithAudio.length; i++) {
        const page = pagesWithAudio[i];
        const filename = `${currentStorybook.title}_페이지_${page.pageNumber}.mp3`;
        
        try {
            await downloadAudio(page.audioUrl, filename);
            downloadCount++;
            
            // 다운로드 간 약간의 지연 (브라우저 제한 방지)
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`페이지 ${page.pageNumber} 다운로드 실패:`, error);
        }
    }
    
    showNotification('success', '일괄 다운로드 완료', `${downloadCount}개의 MP3 파일이 다운로드되었습니다.`);
}

// 단어 업데이트 함수
function updateVocabularyWord(wordIndex, newValue, field = 'word') {
    if (newValue.trim()) {
        const vocab = currentStorybook.educational_content.vocabulary[wordIndex];
        
        // 객체 형식인지 확인
        if (typeof vocab === 'object') {
            vocab[field] = newValue.trim();
        } else {
            // 문자열이면 객체로 변환
            if (field === 'word') {
                currentStorybook.educational_content.vocabulary[wordIndex] = {
                    word: newValue.trim(),
                    korean: ''
                };
            }
        }
        
        // 해당 단어의 이미지도 업데이트 (있다면)
        if (currentStorybook.vocabularyImages && currentStorybook.vocabularyImages[wordIndex]) {
            const word = typeof currentStorybook.educational_content.vocabulary[wordIndex] === 'object' 
                ? currentStorybook.educational_content.vocabulary[wordIndex].word 
                : currentStorybook.educational_content.vocabulary[wordIndex];
            currentStorybook.vocabularyImages[wordIndex].word = word;
        }
        
        saveCurrentStorybook();
    }
}

// 한 번에 모든 캐릭터 레퍼런스 생성 (병렬 처리)
async function generateAllCharacterReferences() {
    const toGenerate = currentStorybook.characters.filter(char => !char.referenceImage);
    
    if (toGenerate.length === 0) {
        alert('모든 캐릭터 레퍼런스가 이미 생성되었습니다.');
        return;
    }
    
    if (!confirm(`${toGenerate.length}개의 캐릭터 레퍼런스를 동시에 생성하시겠습니까?\n\n예상 소요 시간: 약 8초`)) {
        return;
    }
    
    // 모든 캐릭터의 로딩 상태 표시
    currentStorybook.characters.forEach((char, i) => {
        if (!char.referenceImage) {
            const refDiv = document.getElementById(`char-ref-${i}`);
            if (refDiv) {
                refDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-3"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-2"></div><p class="text-white text-sm font-semibold">AI가 이미지 생성 중...</p><p class="text-white text-xs opacity-75 mt-1">실패 시 자동으로 재시도합니다</p></div>';
            }
        }
    });
    
    try {
        // 모든 캐릭터를 병렬로 생성
        const promises = currentStorybook.characters.map(async (char, i) => {
            try {
                const promptTextarea = document.getElementById(`char-prompt-${i}`);
                const customPrompt = promptTextarea ? promptTextarea.value.trim() : char.description;
                
                // 재생성 여부 판단
                const isRegeneration = !!char.referenceImage;
                
                // 클라이언트에서 직접 Gemini API 호출
                const prompt = buildCharacterPrompt(customPrompt, currentStorybook.artStyle, imageSettings, isRegeneration);
                
                // 재생성인 경우 기존 이미지를 레퍼런스로 추가
                const refImageUrls = isRegeneration ? [char.referenceImage] : [];
                
                const result = await generateImageClient(prompt, refImageUrls, 3, imageSettings.characterModel || 'gemini-3-pro-image-preview'); // 캐릭터 레퍼런스 전용 모델 사용
                
                if (result.success && result.imageUrl) {
                    currentStorybook.characters[i].referenceImage = result.imageUrl;
                    return { index: i, success: true, imageUrl: result.imageUrl };
                } else {
                    throw new Error(result.error || '이미지 생성 실패');
                }
            } catch (error) {
                console.error(`Error generating character ${i}:`, error);
                return { index: i, success: false, error: error.message };
            }
        });
        
        const results = await Promise.all(promises);
        
        // 결과 저장
        saveCurrentStorybook();
        
        // 각 캐릭터의 이미지 div만 업데이트 (텍스트 필드는 유지)
        results.forEach(result => {
            if (result.success) {
                const refDiv = document.getElementById(`char-ref-${result.index}`);
                if (refDiv) {
                    const char = currentStorybook.characters[result.index];
                    refDiv.innerHTML = `<img src="${result.imageUrl}" alt="${char.name}" class="w-full h-full object-cover rounded-lg"/>`;
                    
                    // 다운로드 버튼 추가
                    const charCard = refDiv.closest('.character-card');
                    if (charCard) {
                        const existingDownloadBtn = charCard.querySelector('.download-char-btn');
                        if (!existingDownloadBtn) {
                            const promptTextarea = charCard.querySelector(`#char-prompt-${result.index}`);
                            if (promptTextarea) {
                                const downloadBtn = document.createElement('button');
                                downloadBtn.className = 'w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition mb-2 download-char-btn';
                                downloadBtn.innerHTML = '<i class="fas fa-download mr-2"></i>이미지 다운로드';
                                downloadBtn.onclick = () => downloadImage(result.imageUrl, `캐릭터_${char.name}.png`);
                                promptTextarea.parentNode.insertBefore(downloadBtn, promptTextarea);
                            }
                        }
                    }
                }
            } else if (!result.success) {
                // 실패한 경우 에러 표시
                const refDiv = document.getElementById(`char-ref-${result.index}`);
                if (refDiv) {
                    refDiv.innerHTML = `
                        <div class="p-4 text-center">
                            <p class="text-white text-xs mt-2">⚠️ 이미지 생성 실패</p>
                            <p class="text-white text-xs opacity-75 mt-1">${result.error}</p>
                            <button onclick="generateCharacterReference(${result.index})" class="mt-2 px-3 py-1 bg-white text-purple-600 rounded text-xs">재시도</button>
                        </div>
                    `;
                }
            }
        });
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        if (failCount > 0) {
            alert(`캐릭터 레퍼런스 생성/재생성 완료!\n성공: ${successCount}개\n실패: ${failCount}개`);
        } else {
            alert(`모든 캐릭터 레퍼런스 생성/재생성이 완료되었습니다! (${successCount}개)`);
        }
    } catch (error) {
        console.error('Batch generation error:', error);
        alert('배치 생성 중 오류가 발생했습니다: ' + error.message);
        // 에러 시에도 UI 전체를 다시 그리지 않음
    }
}

// 캐릭터 레퍼런스 생성
async function generateCharacterReference(charIndex) {
    const character = currentStorybook.characters[charIndex];
    const refDiv = document.getElementById(`char-ref-${charIndex}`);
    
    const promptTextarea = document.getElementById(`char-prompt-${charIndex}`);
    const customPrompt = promptTextarea ? promptTextarea.value.trim() : character.description;
    
    refDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-3"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-2"></div><p class="text-white text-sm font-semibold">AI가 이미지 생성 중...</p><p class="text-white text-xs opacity-75 mt-1">실패 시 자동으로 재시도합니다</p></div>';

    try {
        // 재생성 여부 판단 (기존 이미지가 있으면 재생성 모드)
        const isRegeneration = !!character.referenceImage;
        
        // 클라이언트에서 직접 Gemini API 호출
        const prompt = buildCharacterPrompt(customPrompt, currentStorybook.artStyle, imageSettings, isRegeneration);
        
        // 재생성인 경우 기존 이미지를 레퍼런스로 추가
        const refImageUrls = [];
        if (character.referenceImage) {
            console.log('🔄 캐릭터 재생성 모드: 기존 이미지를 레퍼런스로 추가');
            refImageUrls.push(character.referenceImage);
        }
        
        console.log(`🎨 캐릭터 "${character.name}" 이미지 생성 ${isRegeneration ? '(재생성 모드 - 사용자 수정사항 반영)' : '(초기 생성)'}`);
        console.log('🤖 사용 모델:', imageSettings.characterModel || 'nano-banana-pro');
        console.log('📝 프롬프트:', customPrompt.substring(0, 100) + '...');
        if (refImageUrls.length > 0) {
            console.log('🖼️ 참조 이미지:', refImageUrls.length, '개');
        }
        
        const result = await generateImageClient(prompt, refImageUrls, 3, imageSettings.characterModel || 'gemini-3-pro-image-preview'); // 캐릭터 전용 모델 사용

        if (result.success && result.imageUrl) {
            const imageUrl = result.imageUrl;
            currentStorybook.characters[charIndex].referenceImage = imageUrl;
            saveCurrentStorybook();
            
            // 이미지만 업데이트 (UI 전체를 다시 그리지 않음)
            refDiv.innerHTML = `<img src="${imageUrl}" alt="${character.name}" class="w-full h-full object-cover rounded-lg"/>`;
            
            // 다운로드 버튼이 없으면 추가
            const charCard = refDiv.closest('.character-card');
            if (charCard) {
                const existingDownloadBtn = charCard.querySelector('.download-char-btn');
                if (!existingDownloadBtn) {
                    const promptTextarea = charCard.querySelector(`#char-prompt-${charIndex}`);
                    if (promptTextarea) {
                        const downloadBtn = document.createElement('button');
                        downloadBtn.className = 'w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition mb-2 download-char-btn';
                        downloadBtn.innerHTML = '<i class="fas fa-download mr-2"></i>이미지 다운로드';
                        downloadBtn.onclick = () => downloadImage(imageUrl, `캐릭터_${character.name}.png`);
                        promptTextarea.parentNode.insertBefore(downloadBtn, promptTextarea);
                    }
                }
            }
        } else {
            throw new Error(result.error || '이미지 URL을 받지 못했습니다.');
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

// 병렬/순차 생성 모드 설명 표시
function showGenerationModeHelp(mode) {
    const helpContent = mode === 'parallel' ? `
        <div class="space-y-4">
            <h3 class="text-xl font-bold text-blue-600 mb-3">
                <i class="fas fa-bolt mr-2"></i>병렬 생성 (빠르게)
            </h3>
            
            <div class="bg-blue-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-2">✨ 특징</h4>
                <ul class="list-disc list-inside text-gray-700 space-y-1 text-sm">
                    <li>모든 페이지를 <strong>동시에</strong> 생성</li>
                    <li>캐릭터 레퍼런스만 참조</li>
                    <li>빠른 속도로 전체 완성</li>
                </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-2">⚡ 추천 상황</h4>
                <ul class="list-disc list-inside text-gray-700 space-y-1 text-sm">
                    <li><strong>초안 확인:</strong> 스토리 전개와 장면 구성을 빠르게 확인</li>
                    <li><strong>테스트 생성:</strong> 그림체나 설정을 테스트</li>
                    <li><strong>시간 제약:</strong> 빠른 결과가 필요할 때</li>
                    <li><strong>독립적인 장면:</strong> 각 페이지가 독립적일 때</li>
                </ul>
            </div>
            
            <div class="bg-yellow-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-2">⚠️ 주의사항</h4>
                <ul class="list-disc list-inside text-gray-700 space-y-1 text-sm">
                    <li>장면 간 연속성이 약할 수 있음</li>
                    <li>캐릭터 포즈나 분위기 변화가 급격할 수 있음</li>
                </ul>
            </div>
            
            <div class="text-center text-sm text-gray-600 mt-4">
                <i class="fas fa-clock mr-1"></i>
                예상 시간: 약 <strong>${Math.ceil(currentStorybook.pages.filter(p => !p.illustrationImage).length / 5) * 8}초</strong>
            </div>
        </div>
    ` : `
        <div class="space-y-4">
            <h3 class="text-xl font-bold text-indigo-600 mb-3">
                <i class="fas fa-layer-group mr-2"></i>순차 생성 (정확하게)
            </h3>
            
            <div class="bg-indigo-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-2">✨ 특징</h4>
                <ul class="list-disc list-inside text-gray-700 space-y-1 text-sm">
                    <li>페이지를 <strong>하나씩 순서대로</strong> 생성</li>
                    <li>각 페이지가 <strong>바로 전 페이지를 자동 참조</strong></li>
                    <li>캐릭터 레퍼런스 + 전 페이지 이미지 조합</li>
                </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-2">🎯 추천 상황</h4>
                <ul class="list-disc list-inside text-gray-700 space-y-1 text-sm">
                    <li><strong>최종 출판물:</strong> 출판하거나 공유할 완성본</li>
                    <li><strong>연속성 중요:</strong> 인어공주처럼 변신 스토리나 시간 흐름</li>
                    <li><strong>일관성 중시:</strong> 캐릭터 포즈, 색감, 분위기의 연속성</li>
                    <li><strong>프로페셔널:</strong> 전문적인 품질이 필요할 때</li>
                </ul>
            </div>
            
            <div class="bg-purple-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-2">🌟 장점</h4>
                <ul class="list-disc list-inside text-gray-700 space-y-1 text-sm">
                    <li>높은 시각적 연속성</li>
                    <li>자연스러운 장면 전환</li>
                    <li>스토리 몰입도 향상</li>
                </ul>
            </div>
            
            <div class="text-center text-sm text-gray-600 mt-4">
                <i class="fas fa-clock mr-1"></i>
                예상 시간: 약 <strong>${currentStorybook.pages.filter(p => !p.illustrationImage).length * 8}초</strong>
            </div>
        </div>
    `;
    
    showModal('생성 모드 가이드', helpContent);
}

// 한 번에 모든 삽화 생성 - 병렬 (빠르게)
async function generateAllIllustrationsParallel() {
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
    
    const estimatedTime = Math.ceil(pagesToGenerate.length / 5) * 8; // 병렬로 약 5개씩 동시 처리
    if (!confirm(`${pagesToGenerate.length}개의 삽화를 병렬로 생성하시겠습니까?\n\n⚡ 빠른 생성: 모든 페이지를 동시에 생성합니다.\n⚠️ 주의: 연속성이 순차 생성보다 약할 수 있습니다.\n\n예상 소요 시간: 약 ${estimatedTime}초`)) {
        return;
    }
    
    // 캐릭터 레퍼런스 준비
    const characterReferences = currentStorybook.characters
        .filter(char => char.referenceImage)
        .map(char => ({
            name: char.name,
            description: char.description,
            referenceImage: char.referenceImage
        }));
    
    // 모든 페이지의 로딩 상태 표시
    currentStorybook.pages.forEach((page, i) => {
        if (!page.illustrationImage) {
            const illustrationDiv = document.getElementById(`illustration-${i}`);
            if (illustrationDiv) {
                illustrationDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-4"><div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-3"></div><p class="text-gray-600 text-sm font-semibold">생성 중...</p><p class="text-gray-500 text-xs mt-1">병렬 생성 (빠르게)</p></div>';
            }
        }
    });
    
    try {
        const promises = [];
        
        // 병렬로 모든 페이지 생성
        for (let i = 0; i < currentStorybook.pages.length; i++) {
            const page = currentStorybook.pages[i];
            
            // 이미 이미지가 있으면 건너뛰기
            if (page.illustrationImage) {
                continue;
            }
            
            const generatePromise = (async (pageIndex) => {
                try {
                    const sceneDesc = document.getElementById(`scene-${pageIndex}`)?.value || page.scene_description;
                    const artStyleElem = document.getElementById(`artstyle-${pageIndex}`);
                    const artStyle = artStyleElem ? artStyleElem.value : (page.artStyle || currentStorybook.artStyle);
                    const sceneCharElem = document.getElementById(`scene-char-${pageIndex}`);
                    const sceneBgElem = document.getElementById(`scene-bg-${pageIndex}`);
                    const sceneAtmElem = document.getElementById(`scene-atm-${pageIndex}`);
                    
                    const sceneStructure = {
                        characters: sceneCharElem ? sceneCharElem.value : page.scene_structure?.characters || '',
                        background: sceneBgElem ? sceneBgElem.value : page.scene_structure?.background || '',
                        atmosphere: sceneAtmElem ? sceneAtmElem.value : page.scene_structure?.atmosphere || ''
                    };
                    
                    // 클라이언트에서 직접 Gemini API 호출
                    const pageData = {
                        ...page,
                        scene_description: sceneDesc,
                        scene_structure: sceneStructure
                    };
                    
                    const prompt = buildIllustrationPrompt(pageData, artStyle, characterReferences, imageSettings, '');
                    
                    // 🎯 페이지에 등장하는 캐릭터 자동 감지
                    const pageText = page.text || '';
                    const sceneCharacters = (sceneStructure && sceneStructure.characters) || '';
                    const allText = `${pageText} ${sceneCharacters}`.toLowerCase();
                    
                    // 이 페이지에 등장하는 캐릭터만 필터링
                    const relevantCharacters = characterReferences.filter(char => {
                        const charName = char.name.toLowerCase();
                        return allText.includes(charName) || 
                               allText.includes(char.description.toLowerCase().split(' ')[0]);
                    });
                    
                    // 등장하지 않으면 모든 캐릭터 포함 (안전장치)
                    const filteredCharacterRefs = relevantCharacters.length > 0 ? relevantCharacters : characterReferences;
                    
                    // 레퍼런스 이미지 수집: 등장 캐릭터만 (병렬이므로 전 페이지 참조 없음)
                    const refImageUrls = filteredCharacterRefs.map(char => char.referenceImage);
                    
                    const result = await generateImageClient(prompt, refImageUrls, 3, imageSettings.illustrationModel || 'gemini-3-pro-image-preview'); // 페이지 삽화 전용 모델 사용
                    
                    if (result.success && result.imageUrl) {
                        currentStorybook.pages[pageIndex].illustrationImage = result.imageUrl;
                        currentStorybook.pages[pageIndex].scene_description = sceneDesc;
                        currentStorybook.pages[pageIndex].scene_structure = sceneStructure;
                        currentStorybook.pages[pageIndex].artStyle = artStyle;
                        
                        // 성공 표시
                        const illustrationDiv = document.getElementById(`illustration-${pageIndex}`);
                        if (illustrationDiv) {
                            illustrationDiv.innerHTML = `<img src="${result.imageUrl}" alt="Page ${page.pageNumber}" class="w-full h-full object-cover rounded-lg"/>`;
                        }
                        
                        return { success: true, pageIndex };
                    } else {
                        throw new Error(result.error || '이미지 생성 실패');
                    }
                } catch (error) {
                    console.error(`Error generating illustration ${pageIndex}:`, error);
                    
                    // 실패 표시
                    const illustrationDiv = document.getElementById(`illustration-${pageIndex}`);
                    if (illustrationDiv) {
                        illustrationDiv.innerHTML = `
                            <div class="p-6 text-center">
                                <p class="text-red-600 text-sm mb-2">⚠️ 생성 실패</p>
                                <p class="text-gray-500 text-xs">${error.message}</p>
                            </div>
                        `;
                    }
                    
                    return { success: false, pageIndex, error: error.message };
                }
            })(i);
            
            promises.push(generatePromise);
        }
        
        // 모든 병렬 생성 완료 대기
        const results = await Promise.all(promises);
        
        // 결과 저장
        saveCurrentStorybook();
        displayStorybook(currentStorybook);
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        if (failCount > 0) {
            alert(`삽화 생성 완료!\n✅ 성공: ${successCount}개\n❌ 실패: ${failCount}개\n\n실패한 페이지는 개별적으로 재시도해주세요.`);
        } else {
            showNotification('success', '모든 삽화 생성 완료! ⚡', `${successCount}개의 페이지 삽화가 병렬로 생성되었습니다.`);
        }
    } catch (error) {
        console.error('Parallel generation error:', error);
        alert('병렬 생성 중 오류가 발생했습니다: ' + error.message);
        displayStorybook(currentStorybook);
    }
}

// 한 번에 모든 삽화 생성 - 순차 (정확하게)
async function generateAllIllustrationsSequential() {
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
    
    const estimatedTime = pagesToGenerate.length * 8; // 페이지당 약 8초
    if (!confirm(`${pagesToGenerate.length}개의 삽화를 순차적으로 생성하시겠습니까?\n\n⭐ 각 페이지가 바로 전 페이지를 참조하여 더 자연스러운 연속성을 만듭니다.\n\n예상 소요 시간: 약 ${estimatedTime}초`)) {
        return;
    }
    
    // 캐릭터 레퍼런스 준비
    const characterReferences = currentStorybook.characters
        .filter(char => char.referenceImage)
        .map(char => ({
            name: char.name,
            description: char.description,
            referenceImage: char.referenceImage
        }));
    
    // 모든 페이지의 로딩 상태 표시
    currentStorybook.pages.forEach((page, i) => {
        if (!page.illustrationImage) {
            const illustrationDiv = document.getElementById(`illustration-${i}`);
            if (illustrationDiv) {
                illustrationDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-4"><div class="animate-spin rounded-full h-16 w-16 border-b-4 border-gray-400 mb-3"></div><p class="text-gray-600 text-sm font-semibold">대기 중...</p><p class="text-gray-500 text-xs mt-1">순차적으로 생성됩니다</p></div>';
            }
        }
    });
    
    try {
        let successCount = 0;
        let failCount = 0;
        
        // 순차적으로 페이지별 생성 (앞 페이지부터)
        for (let i = 0; i < currentStorybook.pages.length; i++) {
            const page = currentStorybook.pages[i];
            
            // 이미 이미지가 있으면 건너뛰기
            if (page.illustrationImage) {
                continue;
            }
            
            const illustrationDiv = document.getElementById(`illustration-${i}`);
            if (illustrationDiv) {
                illustrationDiv.innerHTML = `<div class="flex flex-col items-center justify-center h-full p-4"><div class="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mb-3"></div><p class="text-gray-600 text-sm font-semibold">페이지 ${page.pageNumber} 생성 중...</p><p class="text-gray-500 text-xs mt-1">${successCount + failCount + 1}/${pagesToGenerate.length}</p></div>`;
            }
            
            try {
                const sceneDesc = document.getElementById(`scene-${i}`)?.value || page.scene_description;
                const artStyleElem = document.getElementById(`artstyle-${i}`);
                const artStyle = artStyleElem ? artStyleElem.value : (page.artStyle || currentStorybook.artStyle);
                const sceneCharElem = document.getElementById(`scene-char-${i}`);
                const sceneBgElem = document.getElementById(`scene-bg-${i}`);
                const sceneAtmElem = document.getElementById(`scene-atm-${i}`);
                
                const sceneStructure = {
                    characters: sceneCharElem ? sceneCharElem.value : page.scene_structure?.characters || '',
                    background: sceneBgElem ? sceneBgElem.value : page.scene_structure?.background || '',
                    atmosphere: sceneAtmElem ? sceneAtmElem.value : page.scene_structure?.atmosphere || ''
                };
                
                // 클라이언트에서 직접 Gemini API 호출
                const pageData = {
                    ...page,
                    scene_description: sceneDesc,
                    scene_structure: sceneStructure
                };
                
                const prompt = buildIllustrationPrompt(pageData, artStyle, characterReferences, imageSettings, '');
                
                // 🎯 페이지에 등장하는 캐릭터 자동 감지
                const pageText = page.text || '';
                const sceneCharacters = (sceneStructure && sceneStructure.characters) || '';
                const allText = `${pageText} ${sceneCharacters}`.toLowerCase();
                
                // 이 페이지에 등장하는 캐릭터만 필터링
                const relevantCharacters = characterReferences.filter(char => {
                    const charName = char.name.toLowerCase();
                    return allText.includes(charName) || 
                           allText.includes(char.description.toLowerCase().split(' ')[0]);
                });
                
                // 등장하지 않으면 모든 캐릭터 포함 (안전장치)
                const filteredCharacterRefs = relevantCharacters.length > 0 ? relevantCharacters : characterReferences;
                
                // 레퍼런스 이미지 수집: 등장 캐릭터 + 바로 전 페이지
                const refImageUrls = filteredCharacterRefs.map(char => char.referenceImage);
                
                // ⭐ 바로 전 페이지의 이미지를 자동으로 참조 (연속성 향상)
                if (i > 0) {
                    const previousPage = currentStorybook.pages[i - 1];
                    if (previousPage && previousPage.illustrationImage) {
                        console.log(`📖 페이지 ${page.pageNumber}: 바로 전 페이지(${previousPage.pageNumber})의 이미지를 자동 참조`);
                        refImageUrls.push(previousPage.illustrationImage);
                    }
                }
                
                const result = await generateImageClient(prompt, refImageUrls, 3, imageSettings.illustrationModel || 'gemini-3-pro-image-preview'); // 페이지 삽화 전용 모델 사용
                
                if (result.success && result.imageUrl) {
                    currentStorybook.pages[i].illustrationImage = result.imageUrl;
                    currentStorybook.pages[i].scene_description = sceneDesc;
                    currentStorybook.pages[i].scene_structure = sceneStructure;
                    currentStorybook.pages[i].artStyle = artStyle;
                    saveCurrentStorybook(); // 각 페이지마다 저장
                    successCount++;
                    
                    // 성공 표시
                    if (illustrationDiv) {
                        illustrationDiv.innerHTML = `<img src="${result.imageUrl}" alt="Page ${page.pageNumber}" class="w-full h-full object-cover rounded-lg"/>`;
                    }
                } else {
                    throw new Error(result.error || '이미지 생성 실패');
                }
            } catch (error) {
                console.error(`Error generating illustration ${i}:`, error);
                failCount++;
                
                // 실패 표시
                if (illustrationDiv) {
                    illustrationDiv.innerHTML = `
                        <div class="p-6 text-center">
                            <p class="text-red-600 text-sm mb-2">⚠️ 생성 실패</p>
                            <p class="text-gray-500 text-xs">${error.message}</p>
                        </div>
                    `;
                }
            }
        }
        
        // 최종 결과 표시 및 UI 업데이트
        displayStorybook(currentStorybook);
        
        if (failCount > 0) {
            alert(`삽화 생성 완료!\n✅ 성공: ${successCount}개\n❌ 실패: ${failCount}개\n\n실패한 페이지는 개별적으로 재시도해주세요.`);
        } else {
            showNotification('success', '모든 삽화 생성 완료! 🎯', `${successCount}개의 페이지 삽화가 순차적으로 생성되었습니다.`);
        }
    } catch (error) {
        console.error('Batch generation error:', error);
        alert('배치 생성 중 오류가 발생했습니다: ' + error.message);
        displayStorybook(currentStorybook);
    }
}

// 페이지 삽화 생성
async function generateIllustration(pageIndex) {
    const page = currentStorybook.pages[pageIndex];
    const sceneDesc = document.getElementById(`scene-${pageIndex}`).value;
    const artStyleElem = document.getElementById(`artstyle-${pageIndex}`);
    const artStyle = artStyleElem ? artStyleElem.value : currentStorybook.artStyle;
    const illustrationDiv = document.getElementById(`illustration-${pageIndex}`);
    
    // 수정사항 입력 필드 읽기
    const editNoteElem = document.getElementById(`edit-note-${pageIndex}`);
    const editNote = editNoteElem ? editNoteElem.value.trim() : '';
    
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
    
    illustrationDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-4"><div class="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mb-3"></div><p class="text-gray-600 text-sm font-semibold">AI가 삽화를 생성하는 중...</p><p class="text-gray-500 text-xs mt-1">실패 시 자동으로 재시도합니다</p></div>';

    try {
        // 클라이언트에서 직접 Gemini API 호출
        const pageData = {
            ...page,
            scene_description: sceneDesc,
            scene_structure: sceneStructure
        };
        
        const prompt = buildIllustrationPrompt(pageData, artStyle, characterReferences, imageSettings, editNote);
        
        // 레퍼런스 이미지 수집 전략 (사용자 요청: 재생성 시 제한 해제):
        // - 재생성 + editNote 있음: 모든 필요한 캐릭터 + 현재 이미지 + 전 페이지
        // - 재생성 + editNote 없음: 모든 필요한 캐릭터 + 전 페이지 + 현재 이미지
        // - 신규 생성: 모든 필요한 캐릭터 + 전 페이지 + 사용자 선택
        
        const isRegeneration = !!page.illustrationImage;
        const hasEditNote = editNote && editNote.trim().length > 0;
        
        // 🎯 페이지에 등장하는 캐릭터 자동 감지
        const pageText = page.text || '';
        const sceneCharacters = (sceneStructure && sceneStructure.characters) || '';
        const allText = `${pageText} ${sceneCharacters} ${editNote}`.toLowerCase();
        
        // 이 페이지에 등장하는 캐릭터만 필터링
        const relevantCharacters = characterReferences.filter(char => {
            const charName = char.name.toLowerCase();
            return allText.includes(charName) || 
                   allText.includes(char.description.toLowerCase().split(' ')[0]);
        });
        
        // 등장하지 않으면 모든 캐릭터 포함 (안전장치)
        const filteredCharacterRefs = relevantCharacters.length > 0 ? relevantCharacters : characterReferences;
        
        console.log(`👥 캐릭터 필터링: 전체 ${characterReferences.length}명 → 등장 ${filteredCharacterRefs.length}명`);
        if (filteredCharacterRefs.length < characterReferences.length) {
            console.log(`   등장 캐릭터: ${filteredCharacterRefs.map(c => c.name).join(', ')}`);
        }
        
        let refImageUrls = [];
        
        // 1. 등장하는 캐릭터 레퍼런스만 포함
        refImageUrls = filteredCharacterRefs.map(char => char.referenceImage);
        console.log(`👥 등장 캐릭터 레퍼런스: ${refImageUrls.length}개`);
        
        // 2. 재생성 + 수정사항 있음 → 전 페이지 + 현재 이미지 (제한 해제)
        if (isRegeneration && hasEditNote) {
            console.log('🔄 재생성 모드 (수정사항 있음): 모든 참조 이미지 사용 (제한 해제)');
            // 바로 전 페이지
            if (pageIndex > 0) {
                const previousPage = currentStorybook.pages[pageIndex - 1];
                if (previousPage && previousPage.illustrationImage) {
                    refImageUrls.push(previousPage.illustrationImage);
                }
            }
            // 현재 이미지
            refImageUrls.push(page.illustrationImage);
            // 사용자 선택 참조도 포함
            const selectedRefImages = getSelectedReferenceImages(pageIndex);
            if (selectedRefImages.length > 0) {
                console.log(`🖼️ ${selectedRefImages.length}개의 참조 이미지 추가`);
                selectedRefImages.forEach(refImg => {
                    refImageUrls.push(refImg.imageUrl);
                });
            }
        }
        // 3. 재생성 + 수정사항 없음 → 전 페이지 + 현재 이미지
        else if (isRegeneration && !hasEditNote) {
            console.log('🔄 재생성 모드 (변형): 전 페이지 + 현재 이미지 참조');
            // 바로 전 페이지
            if (pageIndex > 0) {
                const previousPage = currentStorybook.pages[pageIndex - 1];
                if (previousPage && previousPage.illustrationImage) {
                    refImageUrls.push(previousPage.illustrationImage);
                }
            }
            // 현재 이미지
            refImageUrls.push(page.illustrationImage);
        }
        // 4. 신규 생성 → 전 페이지 + 사용자 선택
        else {
            console.log('✨ 신규 생성 모드: 전 페이지 + 사용자 선택 참조');
            // 바로 전 페이지
            if (pageIndex > 0) {
                const previousPage = currentStorybook.pages[pageIndex - 1];
                if (previousPage && previousPage.illustrationImage) {
                    console.log(`📖 바로 전 페이지(${pageIndex})의 이미지를 자동 참조`);
                    refImageUrls.push(previousPage.illustrationImage);
                }
            }
            
            // 사용자가 선택한 참조 이미지
            const selectedRefImages = getSelectedReferenceImages(pageIndex);
            if (selectedRefImages.length > 0) {
                console.log(`🖼️ ${selectedRefImages.length}개의 참조 이미지 추가`);
                selectedRefImages.forEach(refImg => {
                    refImageUrls.push(refImg.imageUrl);
                });
            }
        }
        
        console.log(`📊 최종 레퍼런스 이미지 개수: ${refImageUrls.length}`);

        
        const result = await generateImageClient(prompt, refImageUrls, 3, imageSettings.illustrationModel || 'gemini-3-pro-image-preview'); // 페이지 삽화 전용 모델 사용

        if (result.success && result.imageUrl) {
            const imageUrl = result.imageUrl;
            currentStorybook.pages[pageIndex].illustrationImage = imageUrl;
            currentStorybook.pages[pageIndex].scene_description = sceneDesc;
            currentStorybook.pages[pageIndex].scene_structure = sceneStructure;
            currentStorybook.pages[pageIndex].artStyle = artStyle;
            currentStorybook.pages[pageIndex].editNote = editNote; // 수정사항 저장
            saveCurrentStorybook();
            
            // displayStorybook을 호출하여 수정사항 입력 필드가 표시되도록 함
            displayStorybook(currentStorybook);
        } else {
            throw new Error(result.error || '이미지 URL을 받지 못했습니다.');
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
// 모든 캐릭터 레퍼런스 다운로드
async function downloadAllCharacterReferences() {
    const characters = currentStorybook.characters.filter(char => char.referenceImage);
    
    if (characters.length === 0) {
        alert('다운로드할 캐릭터 레퍼런스가 없습니다.');
        return;
    }
    
    for (const char of characters) {
        try {
            const response = await fetch(char.referenceImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `캐릭터_${char.name}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // 다운로드 간 짧은 지연
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Download error for ${char.name}:`, error);
        }
    }
    
    alert(`${characters.length}개의 캐릭터 레퍼런스를 다운로드했습니다.`);
}

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
    
    // 동화책 페이지
    currentStorybook.pages.forEach((page, idx) => {
        textContent += `[페이지 ${page.pageNumber}]\n${page.text}\n`;
        if (idx < currentStorybook.pages.length - 1) {
            textContent += '\n---\n\n';
        }
    });
    
    // 학습 단어 섹션 추가
    if (currentStorybook.educational_content && 
        currentStorybook.educational_content.vocabulary && 
        currentStorybook.educational_content.vocabulary.length > 0) {
        
        textContent += '\n\n' + `=`.repeat(50) + '\n';
        textContent += '영어 학습 단어\n';
        textContent += `=`.repeat(50) + '\n\n';
        
        currentStorybook.educational_content.vocabulary.forEach((vocabItem, idx) => {
            const word = typeof vocabItem === 'object' ? vocabItem.word : vocabItem;
            const korean = typeof vocabItem === 'object' ? vocabItem.korean : '';
            const definition = typeof vocabItem === 'object' ? vocabItem.definition : '';
            const exampleSentence = typeof vocabItem === 'object' ? vocabItem.example_sentence : '';
            
            textContent += `[영어] ${word}\n`;
            if (korean) textContent += `[한글] ${korean}\n`;
            if (definition) textContent += `[설명] ${definition}\n`;
            if (exampleSentence) textContent += `[예문] ${exampleSentence}\n`;
            
            if (idx < currentStorybook.educational_content.vocabulary.length - 1) {
                textContent += '\n---\n\n';
            }
        });
    }
    
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

// 전체 텍스트 번역 함수
async function translateAllText() {
    if (!currentStorybook || !currentStorybook.pages || currentStorybook.pages.length === 0) {
        alert('번역할 텍스트가 없습니다.');
        return;
    }
    
    const targetLanguage = document.getElementById('translationLanguage').value;
    const languageNames = {
        'en': 'English',
        'ja': '日本語',
        'zh': '中文',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch',
        'vi': 'Tiếng Việt',
        'th': 'ไทย'
    };
    
    if (!confirm(`모든 페이지를 ${languageNames[targetLanguage]}로 번역하시겠습니까?\n\n이 작업은 약 ${Math.ceil(currentStorybook.pages.length * 2)}초 정도 소요됩니다.`)) {
        return;
    }
    
    // 로딩 표시
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'translation-loading';
    loadingDiv.className = 'fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50';
    loadingDiv.innerHTML = `
        <div class="bg-white rounded-lg p-8 max-w-md">
            <div class="flex flex-col items-center">
                <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
                <p class="text-lg font-semibold text-gray-800 mb-2">텍스트 번역 중...</p>
                <p class="text-sm text-gray-600">잠시만 기다려주세요</p>
            </div>
        </div>
    `;
    document.body.appendChild(loadingDiv);
    
    try {
        const response = await axios.post('/api/translate-storybook', {
            storybook: currentStorybook,
            targetLanguage: targetLanguage
        });
        
        if (response.data.success) {
            // 번역된 내용으로 업데이트
            currentStorybook.pages = response.data.translatedPages;
            currentStorybook.title = response.data.translatedTitle;
            
            if (response.data.translatedTheme) {
                currentStorybook.theme = response.data.translatedTheme;
            }
            
            // 저장 및 표시
            saveCurrentStorybook();
            displayStorybook(currentStorybook);
            
            showNotification('success', '번역 완료!', `모든 텍스트가 ${languageNames[targetLanguage]}로 번역되었습니다.`);
        } else {
            throw new Error(response.data.error || '번역 실패');
        }
    } catch (error) {
        console.error('Translation error:', error);
        alert('번역 중 오류가 발생했습니다: ' + (error.response?.data?.error || error.message));
    } finally {
        // 로딩 제거
        if (document.getElementById('translation-loading')) {
            document.getElementById('translation-loading').remove();
        }
    }
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

// 참조 이미지 토글
function toggleReferenceImage(currentPageIdx, refPageIdx) {
    const checkbox = document.getElementById(`ref-check-${currentPageIdx}-${refPageIdx}`);
    const img = document.getElementById(`ref-img-${currentPageIdx}-${refPageIdx}`);
    
    if (checkbox && img) {
        checkbox.checked = !checkbox.checked;
        
        if (checkbox.checked) {
            img.classList.remove('border-gray-300');
            img.classList.add('border-blue-500', 'ring-2', 'ring-blue-300');
        } else {
            img.classList.add('border-gray-300');
            img.classList.remove('border-blue-500', 'ring-2', 'ring-blue-300');
        }
    }
}

// 선택된 참조 이미지 가져오기
function getSelectedReferenceImages(pageIndex) {
    const selectedImages = [];
    
    // 1. 다른 페이지의 참조 이미지
    const pageCheckboxes = document.querySelectorAll(`input[id^="ref-check-${pageIndex}-"]:checked`);
    
    pageCheckboxes.forEach(checkbox => {
        const refPageIdx = parseInt(checkbox.id.split('-').pop());
        const refPage = currentStorybook.pages[refPageIdx];
        
        if (refPage && refPage.illustrationImage) {
            selectedImages.push({
                type: 'page',
                pageNumber: refPage.pageNumber,
                imageUrl: refPage.illustrationImage
            });
        }
    });
    
    // 2. Key Object 참조 이미지
    const keyObjCheckboxes = document.querySelectorAll(`input[id^="ref-keyobj-check-${pageIndex}-"]:checked`);
    
    keyObjCheckboxes.forEach(checkbox => {
        const objIdx = parseInt(checkbox.id.split('-').pop());
        const keyObjImage = currentStorybook.keyObjectImages && currentStorybook.keyObjectImages[objIdx];
        
        if (keyObjImage && keyObjImage.imageUrl) {
            selectedImages.push({
                type: 'key_object',
                name: keyObjImage.name,
                korean: keyObjImage.korean,
                imageUrl: keyObjImage.imageUrl
            });
        }
    });
    
    console.log(`📸 페이지 ${pageIndex + 1} - 선택된 참조 이미지:`, selectedImages.length, 
                `(페이지: ${selectedImages.filter(img => img.type === 'page').length}, Key Objects: ${selectedImages.filter(img => img.type === 'key_object').length})`);
    return selectedImages;
}


// 단어 이미지 생성 - 개별 단어 (캐릭터와 사물 일관성 강화)
async function generateSingleVocabularyImage(wordIndex) {
    if (!currentStorybook.educational_content || !currentStorybook.educational_content.vocabulary) {
        alert('단어 목록이 없습니다.');
        return;
    }
    
    const vocabItem = currentStorybook.educational_content.vocabulary[wordIndex];
    const word = typeof vocabItem === 'object' ? vocabItem.word : vocabItem;
    const korean = typeof vocabItem === 'object' ? vocabItem.korean : '';
    const vocabImgDiv = document.getElementById(`vocab-img-${wordIndex}`);
    
    vocabImgDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-4"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-2"></div><p class="text-gray-600 text-xs">생성 중...</p></div>';
    
    try {
        // ⭐ 1. Key Objects에서 매칭 확인 (정확한 매칭만) - 우선 확인!
        // 8단어 이미지는 Key Object만 참조 (캐릭터 레퍼런스 제외)
        const matchingKeyObject = currentStorybook.key_objects && currentStorybook.key_objects.find((obj, idx) => {
            const hasImage = currentStorybook.keyObjectImages && currentStorybook.keyObjectImages[idx] && currentStorybook.keyObjectImages[idx].imageUrl;
            if (!hasImage) return false;
            
            const objNameLower = obj.name.toLowerCase().trim();
            const objKoreanLower = obj.korean.toLowerCase().trim();
            const wordLower = word.toLowerCase().trim();
            const koreanLower = korean.toLowerCase().trim();
            
            // 정확히 일치하는 경우만 매칭
            return objNameLower === wordLower || objKoreanLower === koreanLower;
        });
        
        const matchingKeyObjectIndex = matchingKeyObject ? currentStorybook.key_objects.indexOf(matchingKeyObject) : -1;
        
        // ⭐ 2. 매칭되는 Key Object 이미지가 있으면 재사용
        if (matchingKeyObject && matchingKeyObjectIndex >= 0) {
            const keyObjImage = currentStorybook.keyObjectImages[matchingKeyObjectIndex];
            if (keyObjImage && keyObjImage.imageUrl) {
                console.log(`✅ Reusing Key Object image for "${word}" (${korean}): ${matchingKeyObject.name}`);
                
                const imageUrl = keyObjImage.imageUrl;
                
                if (!currentStorybook.vocabularyImages) {
                    currentStorybook.vocabularyImages = new Array(currentStorybook.educational_content.vocabulary.length).fill(null);
                }
                
                currentStorybook.vocabularyImages[wordIndex] = {
                    word: word,
                    korean: korean,
                    imageUrl: imageUrl,
                    success: true,
                    isKeyObject: true,
                    reused: true
                };
                
                saveCurrentStorybook();
                
                const badge = '<span class="absolute top-1 right-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded">핵심사물</span>';
                vocabImgDiv.innerHTML = `<div class="relative w-full h-full">${badge}<img src="${imageUrl}" alt="${word}" class="w-full h-full object-cover rounded-lg"/></div>`;
                
                console.log(`✅ Vocabulary image reused from Key Object: ${word}`);
                return { index: wordIndex, success: true, imageUrl: imageUrl, reused: true };
            }
        }
        
        // ⭐ 4. 매칭되는 이미지가 없으면 새로 생성
        console.log(`🎨 Generating new image for "${word}" (${korean})`);
        
        // 이 단어가 주요 사물인지 확인 (scene_structure)
        const allKeyObjects = [];
        currentStorybook.pages.forEach(page => {
            if (page.scene_structure && page.scene_structure.key_objects) {
                allKeyObjects.push(page.scene_structure.key_objects);
            }
        });
        const isKeyObject = allKeyObjects.some(objDesc => 
            objDesc && objDesc.toLowerCase().includes(korean.toLowerCase())
        );
        
        let prompt;
        let referenceImages = [];
        
        // 8단어 이미지는 Key Object만 참조하므로 캐릭터 매칭 로직 제거됨
        // 주요 사물인 경우 - scene_structure의 key_objects 설명 활용
        if (isKeyObject) {
            console.log(`🔑 Key object found for "${word}" (${korean})`);
            
            // key_objects에서 관련 설명 찾기
            const objectDescription = allKeyObjects.find(objDesc => 
                objDesc && objDesc.toLowerCase().includes(korean.toLowerCase())
            );
            
            prompt = `Create a simple, clear, educational illustration for a children's vocabulary learning card showing an important story object.

**Object to Illustrate:** ${word}${korean ? ` (${korean})` : ''}

**Object Description from Story:**
${objectDescription || '이 동화에서 중요한 역할을 하는 사물입니다.'}

**Art Style:** ${currentStorybook.artStyle} style for children's book illustration.

**Requirements:**
- Show the object clearly and simply
- Clean white background
- **Match the visual description from the story above**
- Bright, vibrant colors
- Child-friendly, appealing design
- Age-appropriate for 4-8 years old
- Focus on the object's distinctive features as described
- Make it consistent with how it appears in the storybook illustrations

**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, or captions in the image. Show ONLY the visual representation.

Create a single, clear object illustration that matches the storybook's visual style.`;
        }
        // 일반 단어인 경우 - 기본 프롬프트
        else {
            console.log(`📝 General word: "${word}" (${korean})`);
            
            prompt = `Create a simple, clear educational illustration of: ${word}${korean ? ` (${korean})` : ''}

Requirements:
- Single object or concept clearly shown
- Clean, white background
- High contrast and vibrant colors
- Professional, educational style
- Suitable for children ages 4-8
- Art style: ${currentStorybook.artStyle}

**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, or captions in the image. Show ONLY the visual representation of the word.

Example: For "Apple", show only a red apple fruit. No text.`;
        }

        const result = await generateImageClient(prompt, referenceImages, 3, imageSettings.vocabularyModel || 'gemini-3-pro-image-preview'); // 8단어 학습 전용 모델 사용
        
        if (result.success && result.imageUrl) {
            const imageUrl = result.imageUrl;
            
            // vocabularyImages 배열 초기화
            if (!currentStorybook.vocabularyImages) {
                currentStorybook.vocabularyImages = new Array(currentStorybook.educational_content.vocabulary.length).fill(null);
            }
            
            currentStorybook.vocabularyImages[wordIndex] = {
                word: word,
                korean: korean,
                imageUrl: imageUrl,
                success: true,
                isCharacter: false,  // 8단어는 캐릭터 매칭 안 함
                isKeyObject: isKeyObject
            };
            
            saveCurrentStorybook();
            
            // UI만 업데이트 (전체 재렌더링 안 함)
            const badge = isKeyObject ? '<span class="absolute top-1 right-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded">핵심사물</span>' : '';
            vocabImgDiv.innerHTML = `<div class="relative">${badge}<img src="${imageUrl}" alt="${word}" class="w-full h-full object-cover rounded-lg"/></div>`;
            
            return { index: wordIndex, success: true, imageUrl: imageUrl };
        } else {
            throw new Error(result.error || '이미지 생성 실패');
        }
        
    } catch (error) {
        console.error('Error:', error);
        vocabImgDiv.innerHTML = `
            <div class="p-4 text-center">
                <p class="text-red-600 text-xs mb-2">⚠️ 생성 실패</p>
                <p class="text-gray-500 text-xs">${error.message}</p>
                <button 
                    onclick="generateSingleVocabularyImage(${wordIndex})"
                    class="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
                >
                    <i class="fas fa-redo mr-1"></i>재시도
                </button>
            </div>
        `;
        return { index: wordIndex, success: false, error: error.message };
    }
}

// 모든 단어 이미지 생성 (병렬)
async function generateAllVocabularyImages() {
    if (!currentStorybook.educational_content || !currentStorybook.educational_content.vocabulary) {
        alert('단어 목록이 없습니다.');
        return;
    }
    
    const vocabulary = currentStorybook.educational_content.vocabulary;
    
    if (!confirm(`${vocabulary.length}개의 단어 이미지를 병렬로 생성하시겠습니까?\n\n모든 이미지가 동시에 생성되어 빠릅니다.`)) {
        return;
    }
    
    console.log('모든 단어 이미지를 병렬로 생성 시작...');
    
    // 병렬로 모든 이미지 생성
    const promises = vocabulary.map((_, index) => 
        generateSingleVocabularyImage(index)
    );
    
    // 모든 생성 완료 대기
    const results = await Promise.all(promises);
    
    // 결과 집계
    const successCount = results.filter(r => r && r.success).length;
    const failCount = results.filter(r => r && !r.success).length;
    
    if (failCount > 0) {
        alert(`단어 이미지 생성 완료!\n\n성공: ${successCount}개\n실패: ${failCount}개\n\n실패한 이미지는 개별적으로 재시도할 수 있습니다.`);
    } else {
        alert(`모든 단어 이미지 생성이 완료되었습니다! (${successCount}개)`);
    }
}

// 모든 단어 이미지 다운로드
async function downloadAllVocabularyImages() {
    if (!currentStorybook.vocabularyImages || currentStorybook.vocabularyImages.length === 0) {
        alert('다운로드할 단어 이미지가 없습니다.');
        return;
    }
    
    const images = currentStorybook.vocabularyImages
        .filter(vocab => vocab && vocab.imageUrl)
        .map(vocab => ({
            url: vocab.imageUrl,
            filename: `단어_${vocab.word}.png`
        }));
    
    if (images.length === 0) {
        alert('다운로드할 단어 이미지가 없습니다.');
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
    
    alert(`${images.length}개의 단어 이미지를 다운로드했습니다.`);
}

// 기존 함수 (호환성 유지)
async function generateVocabularyImages() {
    await generateAllVocabularyImages();
}

function viewVocabularyImage(index) {
    if (currentStorybook.vocabularyImages && currentStorybook.vocabularyImages[index]) {
        const vocabImg = currentStorybook.vocabularyImages[index];
        if (vocabImg && vocabImg.imageUrl) {
            window.open(vocabImg.imageUrl, '_blank');
        }
    }
}

// ===== 프롬프트 생성 함수들 =====

/**
 * 캐릭터 이미지 생성 프롬프트 빌드
 * @param {string} description - 캐릭터 설명
 * @param {string} artStyle - 그림체 스타일
 * @param {object} settings - 이미지 설정
 * @param {boolean} isRegeneration - 재생성 여부 (기존 이미지가 있는 경우)
 * @returns {string} - 완성된 프롬프트
 */
function buildCharacterPrompt(description, artStyle, settings, isRegeneration = false) {
    const noTextPrompt = settings.enforceNoText ? 
        '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, captions, or titles anywhere in the image. Absolutely NO TEXT of any kind.' : 
        '\n\n**NO TEXT:** Do NOT include any text, labels, words, letters, or captions in the image.';
    
    // 재생성 안내 (기존 이미지가 있는 경우)
    const regenerationNote = isRegeneration ? 
        '\n\n**🔄 REGENERATION MODE - CRITICAL INSTRUCTIONS:**\n' +
        '**YOU MUST USE THE PROVIDED REFERENCE IMAGE AS YOUR PRIMARY GUIDE.**\n' +
        '1. CAREFULLY ANALYZE the reference image to understand:\n' +
        '   - Current character design, facial features, body proportions\n' +
        '   - Exact colors (clothing, hair, skin tone, accessories)\n' +
        '   - Art style, line work, and shading technique\n' +
        '   - Overall visual identity and character personality\n' +
        '2. MAINTAIN these exact elements from the reference:\n' +
        '   - Core character design and recognizability\n' +
        '   - Color palette (unless explicitly changed in description)\n' +
        '   - Art style consistency\n' +
        '3. ONLY modify what is explicitly mentioned in the updated character description below.\n' +
        '4. Keep everything else EXACTLY THE SAME as the reference image.\n' +
        '5. The goal is to make a recognizable update, not create a completely new character.\n\n' +
        '**Priority Order:**\n' +
        '1st: Reference Image (base design)\n' +
        '2nd: Updated Character Description (modifications only)\n' +
        '3rd: Art Style (already established in reference)' : 
        '';
    
    const prompt = `Create a professional character design reference sheet for a children's storybook character.

**Character Description:** ${description}
${regenerationNote}

**Art Style:** ${artStyle} style for children's book illustration, suitable for ages 4-8.

**Reference Sheet Layout:**
1. **Center (Front View):** Full-body front view of the character in a neutral standing pose. Show all details clearly.
2. **Side Views:** Three-quarter view and side profile showing the character's proportions and features from different angles.
3. **Expressions:** Three different facial expressions showing the character's personality and emotional range (happy, surprised, thoughtful).
4. **Details:** Clear, consistent details of clothing, colors, and distinctive features that make this character unique and recognizable.

**Background:** Clean white background with subtle grid or guidelines.

**Art Quality:** High-detail, professional children's book illustration quality. Vibrant, appealing colors. Clear, consistent character design suitable for multiple illustrations.

**Character Age Range:** Design appropriate for a children's storybook (ages 4-8).

**Image Aspect Ratio:** ${settings.aspectRatio}
${settings.additionalPrompt ? `\n\n**Additional Instructions:** ${settings.additionalPrompt}` : ''}
${noTextPrompt}`;

    return prompt;
}

/**
 * 페이지 삽화 이미지 생성 프롬프트 빌드
 * @param {object} page - 페이지 객체
 * @param {string} artStyle - 그림체 스타일
 * @param {Array<string>} characterReferences - 캐릭터 레퍼런스 이미지 URL 배열
 * @param {object} settings - 이미지 설정
 * @param {string} editNote - 수정사항 (선택)
 * @returns {string} - 완성된 프롬프트
 */
function buildIllustrationPrompt(page, artStyle, characterReferences, settings, editNote = '') {
    // 재생성 모드 확인
    const isRegeneration = !!page.illustrationImage;
    const hasEditNote = editNote && editNote.trim().length > 0;
    
    // 🎯 페이지에 등장하는 캐릭터 자동 감지
    const pageText = page.text || '';
    const sceneCharacters = (page.scene_structure && page.scene_structure.characters) || '';
    const editNoteText = editNote || '';
    
    // 모든 관련 텍스트 합치기
    const allText = `${pageText} ${sceneCharacters} ${editNoteText}`.toLowerCase();
    
    // 이 페이지에 등장하는 캐릭터만 필터링
    const relevantCharacters = characterReferences.filter(char => {
        const charName = char.name.toLowerCase();
        // 캐릭터 이름이나 설명이 텍스트에 포함되어 있는지 확인
        return allText.includes(charName) || 
               allText.includes(char.description.toLowerCase().split(' ')[0]); // 설명의 첫 단어
    });
    
    // 등장하지 않으면 모든 캐릭터 포함 (안전장치)
    const filteredCharacters = relevantCharacters.length > 0 ? relevantCharacters : characterReferences;
    
    console.log(`👥 캐릭터 필터링: 전체 ${characterReferences.length}명 → 등장 ${filteredCharacters.length}명`);
    if (filteredCharacters.length < characterReferences.length) {
        console.log(`   등장 캐릭터: ${filteredCharacters.map(c => c.name).join(', ')}`);
    }
    
    // 전체 스토리 맥락 구성 (재생성 시 제한)
    let storyContext = '';
    let previousPageNote = '';
    
    // 재생성 + editNote가 있으면 스토리 컨텍스트 생략 (타임아웃 방지)
    if (!isRegeneration || !hasEditNote) {
        if (currentStorybook && currentStorybook.pages) {
            const previousPages = currentStorybook.pages
                .filter(p => p.pageNumber < page.pageNumber)
                .sort((a, b) => a.pageNumber - b.pageNumber);
            
            if (previousPages.length > 0) {
                // 최근 3페이지만 포함 (타임아웃 방지)
                const recentPages = previousPages.slice(-3);
                console.log(`📖 Including story context from ${recentPages.length} recent pages (limited for performance)`);
                const previousTexts = recentPages
                    .map(p => `Page ${p.pageNumber}: ${p.text}`)
                    .join('\n');
                
                // 바로 전 페이지 강조
                const immediatelyPreviousPage = previousPages[previousPages.length - 1];
                if (immediatelyPreviousPage && immediatelyPreviousPage.illustrationImage) {
                    previousPageNote = `\n\n**🎨 PREVIOUS PAGE REFERENCE (Page ${immediatelyPreviousPage.pageNumber}):**
I have provided the illustration from the immediately previous page as a reference image. Use it to maintain visual continuity and art style.`;
                }
                
                storyContext = `\n\n**RECENT STORY CONTEXT:**
${previousTexts}

**CURRENT PAGE ${page.pageNumber}:** ${page.text}
${previousPageNote}`;
            }
        }
    } else {
        console.log('📖 Skipping story context (regeneration with editNote - timeout prevention)');
    }
    
    let characterInfo = '';
    
    // 캐릭터 레퍼런스 정보 추가 (필터링된 캐릭터만)
    if (filteredCharacters.length > 0 && settings.enforceCharacterConsistency) {
        characterInfo = '\n\n**Character References (MUST FOLLOW EXACTLY):**\n';
        characterInfo += 'You have been provided with character reference images. ';
        
        if (settings.enforceCharacterConsistency) {
            characterInfo += '**ABSOLUTE REQUIREMENT:** Recreate each character PIXEL-FOR-PIXEL from the reference images. ';
            characterInfo += 'Match EXACTLY: facial features, body proportions, clothing, colors, hairstyle, and all visual details. ';
            characterInfo += 'The characters in this illustration MUST be visually identical to the reference images.\n\n';
        }
        
        filteredCharacters.forEach((char, index) => {
            if (char.referenceImage) {
                characterInfo += `${index + 1}. **${char.name}:** ${char.description}\n`;
                if (settings.enforceCharacterConsistency) {
                    characterInfo += `   - **CRITICAL:** Use reference image to ensure ABSOLUTE PIXEL-PERFECT consistency.\n`;
                    characterInfo += `   - Match ALL visual details from the reference image exactly.\n`;
                }
            }
        });
    }
    
    // 장면 구조 정보 추가
    let sceneDetails = '';
    if (page.scene_structure) {
        sceneDetails = `\n\n**Scene Structure:**
- **Characters & Actions:** ${page.scene_structure.characters}
- **Background Setting:** ${page.scene_structure.background}
- **Mood & Atmosphere:** ${page.scene_structure.atmosphere}`;
    }
    
    const noTextPrompt = settings.enforceNoText ? 
        '\n\n**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, captions, titles, speech bubbles, or text overlays in the image. Absolutely NO TEXT of any kind. Pure illustration only.' : 
        '\n\n**IMPORTANT:** Do NOT include any text, labels, words, letters, or captions in the image. No speech bubbles, no titles, no text overlays. Pure illustration only.';
    
    // 재생성 안내 (기존 이미지가 있는 경우) - isRegeneration은 이미 위에서 선언됨
    const regenerationNote = isRegeneration ? 
        '\n\n**🔄 REGENERATION MODE - CRITICAL INSTRUCTIONS:**\n' +
        '**YOU ARE REGENERATING AN EXISTING ILLUSTRATION WITH USER\'S SPECIFIC MODIFICATIONS.**\n\n' +
        '**STEP 1 - ANALYZE REFERENCE IMAGES:**\n' +
        '1. CAREFULLY study the provided reference images:\n' +
        '   - Current illustration (what it looks like now)\n' +
        '   - Character reference sheets (how characters should look)\n' +
        '   - Selected reference pages (additional context)\n' +
        '   - Overall composition, color palette, and art style\n\n' +
        '**STEP 2 - READ MODIFICATION REQUEST:**\n' +
        (editNote ? 
        '2. User\'s modification request:\n' +
        `   "${editNote}"\n\n` +
        '   **YOUR TASK:**\n' +
        '   - CREATE the scene based on this modification request\n' +
        '   - USE the reference images to maintain:\n' +
        '     • Character visual consistency (faces, clothing, proportions)\n' +
        '     • Art style and color palette\n' +
        '     • Overall composition quality\n' +
        '   - IGNORE the original scene description below\n' +
        '   - FOCUS on what the user wants to see\n\n' : 
        '2. No specific modification request provided.\n' +
        '   - Create a slightly varied version\n' +
        '   - Keep characters and composition similar\n' +
        '   - Maintain art style consistency\n\n') +
        '**⚠️ CRITICAL REQUIREMENTS:**\n' +
        '• Characters MUST be visually IDENTICAL to reference sheets\n' +
        '• Follow the modification request (not the original scene description)\n' +
        '• Reference images are for VISUAL STYLE only, not for scene content\n' +
        '• Create what the user wants to see now\n\n' +
        '**Priority Order for REGENERATION:**\n' +
        '1st: User\'s Modification Request (what to create)\n' +
        '2nd: Character Reference Sheets (how characters look)\n' +
        '3rd: Reference Images (visual style guide)\n' +
        '4th: Art Style (maintain consistency)\n\n' +
        '**IGNORE these during regeneration:**\n' +
        '❌ Original scene description (shown below for reference only)\n' +
        '❌ Original scene structure (outdated)\n' : 
        '';
    
    const prompt = `Create a beautiful, professional illustration for a children's storybook page.
${storyContext}

${isRegeneration && editNote ? 
`**🎯 YOUR TASK (Regeneration with Modification):**
${editNote}

**Reference Information (for visual style only):**
- Original scene description: ${page.scene_description}
${sceneDetails ? `${sceneDetails}` : ''}

**IMPORTANT:** Create the scene based on the modification request above, NOT the original scene description. Use the original description only to understand context.` 
: 
isRegeneration ? 
`**🎯 YOUR TASK (Regeneration - Variation):**
Create a slight variation of the current illustration while maintaining the same scene.

**Scene Description:** ${page.scene_description}
${sceneDetails}` 
: 
`**Main Scene Description:** ${page.scene_description}
${sceneDetails}`}
${characterInfo}
${regenerationNote}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${settings.aspectRatio}
${isRegeneration ? '\n**⚠️ CRITICAL: MAINTAIN EXACT ASPECT RATIO** - The image MUST be exactly ' + settings.aspectRatio + '. Do NOT change the aspect ratio from the original image.' : ''}

**Composition:** Create a warm, inviting scene that captures the emotion and action of the story moment. Use a horizontal composition suitable for a storybook spread.
${currentStorybook && currentStorybook.pages && page.pageNumber > 1 ? '\n**🎯 DIRECTIONAL CONSISTENCY:** Analyze the previous page\'s character positions and maintain consistent left-right orientation throughout the story. If a character was facing right in the previous scene, keep them facing right unless the story requires a directional change.' : ''}

**Lighting & Atmosphere:** Soft, warm lighting with gentle shadows. The scene should feel magical yet safe and welcoming for young children.

**Color Palette:** Vibrant, cheerful colors appropriate for children ages 4-8. Use color psychology to enhance the emotional impact of the scene.

**Art Quality:** High-detail, professional children's book illustration quality with painterly texture and depth.

**Target Audience:** Children ages 4-8. The illustration should be engaging, age-appropriate, and emotionally resonant.
${settings.additionalPrompt ? `\n\n**Additional Instructions:** ${settings.additionalPrompt}` : ''}
${noTextPrompt}`;

    return prompt;
}

// ===== 캐릭터 이미지 업로드 =====
async function uploadCharacterImage(charIndex, inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    
    // 파일 크기 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.');
        return;
    }
    
    // 이미지 파일 체크
    if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.');
        return;
    }
    
    try {
        const refDiv = document.getElementById(`char-ref-${charIndex}`);
        refDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-3"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-2"></div><p class="text-white text-sm font-semibold">이미지 업로드 중...</p></div>';
        
        // FileReader로 이미지를 Base64로 변환
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            
            // Blob URL로 변환 (로컬 저장용)
            const response = await fetch(base64);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            // 캐릭터 레퍼런스 이미지 저장
            currentStorybook.characters[charIndex].referenceImage = blobUrl;
            saveCurrentStorybook();
            
            // UI 업데이트
            refDiv.innerHTML = `<img src="${blobUrl}" alt="${currentStorybook.characters[charIndex].name}" class="w-full h-full object-cover rounded-lg"/>`;
            
            // 다운로드 버튼 추가
            const charCard = refDiv.closest('.character-card');
            if (charCard) {
                const existingDownloadBtn = charCard.querySelector('.download-char-btn');
                if (!existingDownloadBtn) {
                    const promptTextarea = charCard.querySelector(`#char-prompt-${charIndex}`);
                    if (promptTextarea) {
                        const downloadBtn = document.createElement('button');
                        downloadBtn.className = 'w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition mb-2 download-char-btn';
                        downloadBtn.innerHTML = '<i class="fas fa-download mr-2"></i>이미지 다운로드';
                        downloadBtn.onclick = () => downloadImage(blobUrl, `캐릭터_${currentStorybook.characters[charIndex].name}.png`);
                        promptTextarea.parentNode.insertBefore(downloadBtn, promptTextarea);
                    }
                }
            }
            
            console.log(`✅ 캐릭터 "${currentStorybook.characters[charIndex].name}" 이미지 업로드 완료`);
        };
        
        reader.onerror = () => {
            refDiv.innerHTML = '<div class="p-4 text-center"><p class="text-white text-xs">⚠️ 이미지 업로드 실패</p></div>';
            alert('이미지 업로드 중 오류가 발생했습니다.');
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Upload error:', error);
        alert('이미지 업로드 중 오류가 발생했습니다: ' + error.message);
    }
}

// ===== 다시 만들기 모달 =====
function openRegenerateModal() {
    if (!currentStorybook) {
        alert('동화책이 생성되지 않았습니다.');
        return;
    }
    
    // 현재 값으로 모달 필드 채우기
    document.getElementById('regenerateTitle').value = currentStorybook.title;
    document.getElementById('regenerateAge').value = currentStorybook.targetAge;
    document.getElementById('regeneratePages').value = currentStorybook.pages.length;
    document.getElementById('regenerateArtStyle').value = currentStorybook.artStyle;
    document.getElementById('regenerateNotes').value = '';
    
    // 모달 표시
    document.getElementById('regenerateModal').classList.remove('hidden');
}

function closeRegenerateModal() {
    document.getElementById('regenerateModal').classList.add('hidden');
}

async function executeRegenerate() {
    const title = document.getElementById('regenerateTitle').value.trim();
    const targetAge = document.getElementById('regenerateAge').value;
    const totalPages = parseInt(document.getElementById('regeneratePages').value) || 0; // 0 = AI 자동 결정
    const geminiModel = document.getElementById('regenerateModel').value; // AI 모델 선택
    const artStyle = document.getElementById('regenerateArtStyle').value.trim();
    const notes = document.getElementById('regenerateNotes').value.trim();
    
    if (!title) {
        alert('제목을 입력해주세요.');
        return;
    }
    
    // 페이지 수 검증 (0은 자동, 1-30은 사용자 지정)
    if (totalPages < 0 || totalPages > 30) {
        alert('페이지 수는 0(자동) 또는 1-30 사이여야 합니다.');
        return;
    }
    
    if (!confirm('현재 동화책의 캐릭터는 유지하고 스토리만 다시 생성하시겠습니까?')) {
        return;
    }
    
    try {
        // 모달 닫기
        closeRegenerateModal();
        
        // 로딩 표시
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('storybookResult').innerHTML = '';
        
        // 기존 캐릭터 정보 저장
        const existingCharacters = currentStorybook.characters;
        
        // 서버에 재생성 요청
        const response = await axios.post('/api/generate-storybook', {
            title: title,
            targetAge: targetAge,
            totalPages: totalPages,
            geminiModel: geminiModel, // AI 모델 전달
            artStyle: artStyle,
            referenceContent: notes, // 수정 요청사항을 참고 내용으로 전달
            existingCharacters: existingCharacters.map(char => ({
                name: char.name,
                role: char.role,
                description: char.description
            }))
        });
        
        // 응답 형식 확인
        const newStorybook = response.data.storybook || response.data;
        
        // 기존 캐릭터의 레퍼런스 이미지 복원
        if (newStorybook && newStorybook.characters) {
            newStorybook.characters.forEach((char, index) => {
                if (existingCharacters[index] && existingCharacters[index].referenceImage) {
                    char.referenceImage = existingCharacters[index].referenceImage;
                }
            });
        }
        
        // 현재 동화책 업데이트
        currentStorybook = newStorybook;
        saveCurrentStorybook();
        
        // UI 업데이트
        displayStorybook(currentStorybook);
        
        // 로딩 숨기기
        document.getElementById('loading').classList.add('hidden');
        
        alert('동화책이 성공적으로 재생성되었습니다!');
    } catch (error) {
        console.error('Regeneration error:', error);
        document.getElementById('loading').classList.add('hidden');
        alert('동화책 재생성 중 오류가 발생했습니다: ' + (error.response?.data?.error || error.message));
    }
}

// ==================== 퀴즈 관련 함수 ====================

// 퀴즈 생성
async function generateQuiz(count = 5) {
    if (!currentStorybook || !currentStorybook.pages || currentStorybook.pages.length === 0) {
        alert('동화책을 먼저 생성해주세요.');
        return;
    }
    
    const quizContainer = document.getElementById('quiz-container');
    if (!quizContainer) return;
    
    // 로딩 표시
    quizContainer.innerHTML = `
        <div class="text-center py-8">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p class="text-gray-600">퀴즈를 생성하고 있습니다...</p>
        </div>
    `;
    
    try {
        console.log(`🎯 Generating ${count} quiz questions...`);
        
        const response = await axios.post('/api/generate-quiz', {
            storybook: currentStorybook,
            count: count
        });
        
        if (response.data.success && response.data.quizzes) {
            // quizzes 배열 초기화 (없으면)
            if (!currentStorybook.quizzes) {
                currentStorybook.quizzes = [];
            }
            
            // 새로운 퀴즈 추가
            currentStorybook.quizzes.push(...response.data.quizzes);
            
            // 저장
            saveCurrentStorybook();
            
            // UI 업데이트
            displayStorybook(currentStorybook);
            
            console.log(`✅ Generated ${response.data.quizzes.length} quiz questions`);
        } else {
            throw new Error('퀴즈 생성 실패');
        }
    } catch (error) {
        console.error('퀴즈 생성 오류:', error);
        
        quizContainer.innerHTML = `
            <div class="text-center py-8 text-red-600">
                <i class="fas fa-exclamation-circle text-4xl mb-3"></i>
                <p>퀴즈 생성 중 오류가 발생했습니다.</p>
                <p class="text-sm mt-2">${error.response?.data?.error || error.message}</p>
                <button 
                    onclick="generateQuiz()"
                    class="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                >
                    <i class="fas fa-redo mr-1"></i>다시 시도
                </button>
            </div>
        `;
    }
}

// 퀴즈 정답 보기
function showQuizAnswer(quizIndex) {
    const explanationDiv = document.getElementById(`quiz-explanation-${quizIndex}`);
    if (explanationDiv) {
        explanationDiv.classList.toggle('hidden');
    }
}

// 퀴즈 삭제
function deleteQuiz(quizIndex) {
    if (confirm('이 퀴즈를 삭제하시겠습니까?')) {
        currentStorybook.quizzes.splice(quizIndex, 1);
        saveCurrentStorybook();
        displayStorybook(currentStorybook);
    }
}

// ==================== Key Objects 관련 함수 ====================

// Key Object 필드 업데이트
function updateKeyObjectField(objIndex, field, value) {
    if (!currentStorybook.key_objects || !currentStorybook.key_objects[objIndex]) return;
    
    currentStorybook.key_objects[objIndex][field] = value;
    saveCurrentStorybook();
}

// Key Object 단일 이미지 생성
async function generateSingleKeyObjectImage(objIndex) {
    if (!currentStorybook || !currentStorybook.key_objects || !currentStorybook.key_objects[objIndex]) {
        alert('Key Object 정보가 없습니다.');
        return;
    }
    
    const obj = currentStorybook.key_objects[objIndex];
    const objImgDiv = document.getElementById(`keyobj-img-${objIndex}`);
    
    if (!objImgDiv) return;
    
    // 로딩 표시
    objImgDiv.innerHTML = '<div class="flex flex-col items-center justify-center h-full p-4"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-2"></div><p class="text-gray-600 text-xs">생성 중...</p></div>';
    
    try {
        console.log(`🎨 Generating Key Object image for: ${obj.name} (${obj.korean})`);
        
        // 프롬프트 생성
        const sizeGuide = obj.size === 'small' ? 'small handheld object' : 
                         obj.size === 'large' ? 'large structure or building' : 
                         'medium-sized object';
        
        const prompt = `Create a detailed, clear illustration of a key story object for a children's storybook.

**Object:** ${obj.name} (${obj.korean})

**Size:** ${sizeGuide}

**Visual Description:**
${obj.description}

**Art Style:** ${currentStorybook.artStyle || 'Disney-style children\'s book illustration'}

**Image Aspect Ratio:** ${imageSettings.aspectRatio}

**Requirements:**
- Show the object clearly and prominently
- Clean white or simple background
- Bright, vibrant colors suitable for children
- Professional, high-quality illustration
- Focus on the distinctive features described above
- Make it recognizable and memorable
${imageSettings.enforceNoText ? '\n\n**CRITICAL: NO TEXT, NO WORDS, NO LETTERS IN THE IMAGE**' : ''}
${imageSettings.additionalPrompt ? '\n\n**Additional Requirements:** ' + imageSettings.additionalPrompt : ''}

Create a single, clear, professional illustration of this key object.`;

        // 이미지 생성
        const result = await generateImageClient(prompt, [], 3, imageSettings.keyObjectModel || 'gemini-3-pro-image-preview'); // Key Object 전용 모델 사용
        
        if (result.success && result.imageUrl) {
            // keyObjectImages 배열 초기화
            if (!currentStorybook.keyObjectImages) {
                currentStorybook.keyObjectImages = [];
            }
            
            // 해당 인덱스에 이미지 저장
            currentStorybook.keyObjectImages[objIndex] = {
                name: obj.name,
                korean: obj.korean,
                imageUrl: result.imageUrl,
                success: true
            };
            
            // 저장
            saveCurrentStorybook();
            
            // UI 업데이트 - 해당 Key Object 이미지만 업데이트
            objImgDiv.innerHTML = `<img src="${result.imageUrl}" alt="${obj.name}" class="w-full h-full object-cover rounded-lg"/>`;
            
            console.log(`✅ Key Object image generated successfully for: ${obj.name}`);
            
            // ⭐ 모든 페이지의 참조 이미지 섹션 새로고침
            refreshAllPageReferenceImages();
            
            return {
                index: objIndex,
                success: true,
                imageUrl: result.imageUrl
            };
        } else {
            throw new Error(result.error || '이미지 생성 실패');
        }
    } catch (error) {
        console.error(`Key Object 이미지 생성 오류 (${obj.name}):`, error);
        
        objImgDiv.innerHTML = `
            <div class="text-center p-4">
                <i class="fas fa-exclamation-circle text-red-500 text-3xl mb-2"></i>
                <p class="text-red-600 text-xs mb-2">생성 실패</p>
                <button 
                    onclick="generateSingleKeyObjectImage(${objIndex})"
                    class="bg-orange-500 text-white px-3 py-1 rounded text-xs hover:bg-orange-600"
                >
                    <i class="fas fa-redo mr-1"></i>재시도
                </button>
            </div>
        `;
        
        return {
            index: objIndex,
            success: false,
            error: error.message
        };
    }
}

// 모든 Key Object 이미지 생성
async function generateAllKeyObjectImages() {
    if (!currentStorybook || !currentStorybook.key_objects || currentStorybook.key_objects.length === 0) {
        alert('Key Object 정보가 없습니다.');
        return;
    }
    
    if (!confirm(`${currentStorybook.key_objects.length}개의 Key Object 이미지를 동시에 생성하시겠습니까?`)) {
        return;
    }
    
    console.log(`🎨 Generating all ${currentStorybook.key_objects.length} Key Object images in parallel...`);
    
    // keyObjectImages 배열 초기화
    if (!currentStorybook.keyObjectImages) {
        currentStorybook.keyObjectImages = new Array(currentStorybook.key_objects.length);
    }
    
    // ⭐ 병렬 생성 (Promise.all 사용)
    const promises = [];
    for (let i = 0; i < currentStorybook.key_objects.length; i++) {
        promises.push(generateSingleKeyObjectImage(i));
    }
    
    try {
        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;
        console.log(`✅ All Key Object images generated: ${successCount}/${currentStorybook.key_objects.length} succeeded`);
        alert(`모든 Key Object 이미지 생성 완료!\n성공: ${successCount}/${currentStorybook.key_objects.length}개`);
    } catch (error) {
        console.error('❌ Error generating Key Object images:', error);
        alert('일부 이미지 생성에 실패했습니다. 개별적으로 다시 시도해주세요.');
    }
}

// 모든 Key Object 이미지 다운로드
function downloadAllKeyObjectImages() {
    if (!currentStorybook || !currentStorybook.keyObjectImages) {
        alert('다운로드할 Key Object 이미지가 없습니다.');
        return;
    }
    
    const images = currentStorybook.keyObjectImages.filter(img => img && img.imageUrl);
    
    if (images.length === 0) {
        alert('다운로드할 Key Object 이미지가 없습니다.');
        return;
    }
    
    images.forEach((img, index) => {
        setTimeout(() => {
            downloadImage(img.imageUrl, `keyobject_${img.name}.png`);
        }, index * 500);
    });
    
    alert(`${images.length}개의 Key Object 이미지 다운로드를 시작합니다.`);
}

// Key Object 참조 토글 (페이지 삽화 생성 시)
function toggleKeyObjectReference(pageIndex, objIndex) {
    const checkbox = document.getElementById(`ref-keyobj-check-${pageIndex}-${objIndex}`);
    const img = document.getElementById(`ref-keyobj-${pageIndex}-${objIndex}`);
    
    if (checkbox && img) {
        checkbox.checked = !checkbox.checked;
        
        if (checkbox.checked) {
            img.classList.remove('border-orange-300');
            img.classList.add('border-orange-600', 'border-4');
        } else {
            img.classList.remove('border-orange-600', 'border-4');
            img.classList.add('border-orange-300');
        }
    }
}

// Key Object 추가
function addNewKeyObject() {
    if (!currentStorybook.key_objects) {
        currentStorybook.key_objects = [];
    }
    
    const newKeyObject = {
        name: "New Object",
        korean: "새 사물",
        size: "medium",
        sizeCm: 100,
        description: "이 사물의 상세한 시각적 설명을 입력하세요.",
        example: "이 사물이 등장하는 예시 문장을 입력하세요."
    };
    
    currentStorybook.key_objects.push(newKeyObject);
    saveCurrentStorybook();
    displayStorybook(currentStorybook);
    
    alert('새 Key Object가 추가되었습니다!');
}

// Key Object 삭제
function deleteKeyObject(objIndex) {
    if (confirm(`"${currentStorybook.key_objects[objIndex].name}" 사물을 삭제하시겠습니까?`)) {
        currentStorybook.key_objects.splice(objIndex, 1);
        
        // 이미지도 함께 삭제
        if (currentStorybook.keyObjectImages && currentStorybook.keyObjectImages[objIndex]) {
            currentStorybook.keyObjectImages.splice(objIndex, 1);
        }
        
        saveCurrentStorybook();
        displayStorybook(currentStorybook);
        
        alert('Key Object가 삭제되었습니다.');
    }
}

// 모든 페이지의 참조 이미지 섹션 새로고침
function refreshAllPageReferenceImages() {
    console.log('🔄 Refreshing all page reference images...');
    
    // displayStorybook을 다시 호출하여 전체 UI 갱신
    // 이렇게 하면 모든 페이지의 Key Object 참조 이미지가 업데이트됨
    displayStorybook(currentStorybook);
}

// 8단어 TXT 다운로드
function downloadVocabularyTxt() {
    if (!currentStorybook || !currentStorybook.educational_content || !currentStorybook.educational_content.vocabulary) {
        alert('다운로드할 단어가 없습니다.');
        return;
    }
    
    const vocabulary = currentStorybook.educational_content.vocabulary;
    let txtContent = `========================================\n`;
    txtContent += `   ${currentStorybook.title} - 영어 단어 학습\n`;
    txtContent += `========================================\n\n`;
    txtContent += `대상 연령: ${currentStorybook.targetAge}세\n`;
    txtContent += `생성 일시: ${new Date(currentStorybook.createdAt).toLocaleString('ko-KR')}\n`;
    txtContent += `총 단어 수: ${vocabulary.length}개\n\n`;
    txtContent += `========================================\n\n`;
    
    vocabulary.forEach((vocabItem, index) => {
        const word = typeof vocabItem === 'object' ? vocabItem.word : vocabItem;
        const korean = typeof vocabItem === 'object' ? vocabItem.korean : '';
        const definition = typeof vocabItem === 'object' ? vocabItem.definition : '';
        const example = typeof vocabItem === 'object' ? vocabItem.example : '';
        
        txtContent += `${index + 1}. ${word}${korean ? ` (${korean})` : ''}\n`;
        txtContent += `${'='.repeat(50)}\n`;
        
        if (definition) {
            txtContent += `\n[설명]\n${definition}\n`;
        }
        
        if (example) {
            txtContent += `\n[예문]\n${example}\n`;
        }
        
        txtContent += `\n\n`;
    });
    
    txtContent += `========================================\n`;
    txtContent += `파일 생성: ${new Date().toLocaleString('ko-KR')}\n`;
    txtContent += `========================================\n`;
    
    // TXT 파일 다운로드
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentStorybook.title}_영어단어학습_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    console.log(`✅ Vocabulary TXT downloaded: ${vocabulary.length} words`);
}
