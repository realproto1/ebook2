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
            imageQuality: 'high'
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
                <div>
                    <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-users mr-2 text-purple-500"></i>
                        캐릭터 레퍼런스
                    </h3>
                    <p class="text-xs md:text-base text-gray-600">
                        <i class="fas fa-info-circle mr-2"></i>
                        <span class="hidden sm:inline">각 캐릭터의 레퍼런스 이미지를 생성하면 삽화에서 일관된 모습을 유지할 수 있어요.</span>
                        <span class="sm:hidden">레퍼런스 이미지로 일관성 유지</span>
                    </p>
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
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
                                <span class="bg-white text-purple-600 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-semibold">
                                    ${char.role}
                                </span>
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

        <!-- 페이지 섹션 -->
        <div class="bg-white rounded-3xl shadow-2xl p-10 mb-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-3xl font-bold text-gray-800">
                    <i class="fas fa-book mr-2 text-purple-500"></i>
                    스토리 페이지 (${storybook.pages.length}페이지)
                </h3>
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
                </div>
            </div>

            <div class="space-y-6">
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

                                <h5 class="font-bold text-gray-700 mb-2 text-sm md:text-base">장면 설명</h5>
                                <textarea 
                                    id="scene-${idx}" 
                                    class="w-full p-2 md:p-3 border-2 border-gray-300 rounded-lg text-xs md:text-sm mb-2"
                                    rows="2"
                                >${page.scene_description}</textarea>
                                
                                <h5 class="font-bold text-gray-700 mb-2 mt-3 text-sm md:text-base">그림체</h5>
                                <input 
                                    id="artstyle-${idx}" 
                                    value="${page.artStyle || storybook.artStyle}"
                                    placeholder="그림체 (예: 현대 일러스트레이션)"
                                    class="w-full p-2 border-2 border-gray-300 rounded-lg text-xs md:text-sm mb-2"
                                />
                                
                                ${page.scene_structure ? `
                                <h5 class="font-bold text-gray-700 mb-2 mt-3 text-sm md:text-base">장면 구조</h5>
                                <div class="space-y-2 mb-2">
                                    <input 
                                        id="scene-char-${idx}" 
                                        value="${page.scene_structure.characters || ''}"
                                        placeholder="캐릭터 & 행동"
                                        class="w-full p-2 border border-gray-300 rounded text-xs md:text-sm"
                                    />
                                    <input 
                                        id="scene-bg-${idx}" 
                                        value="${page.scene_structure.background || ''}"
                                        placeholder="배경"
                                        class="w-full p-2 border border-gray-300 rounded text-xs md:text-sm"
                                    />
                                    <input 
                                        id="scene-atm-${idx}" 
                                        value="${page.scene_structure.atmosphere || ''}"
                                        placeholder="분위기"
                                        class="w-full p-2 border border-gray-300 rounded text-xs md:text-sm"
                                    />
                                </div>
                                ` : ''}

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
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- 교육 콘텐츠 -->
        <div class="bg-white rounded-3xl shadow-2xl p-4 md:p-10">
            <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6">
                <i class="fas fa-graduation-cap mr-2 text-purple-500"></i>
                교육 콘텐츠
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
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
                        <h4 class="text-xl font-bold text-blue-600">
                            <i class="fas fa-language mr-2"></i>영어 단어 학습 (${storybook.educational_content.vocabulary.length}개)
                        </h4>
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
                                <i class="fas fa-download mr-1"></i>모두 다운로드
                            </button>
                        </div>
                    </div>
                    
                    <div class="grid md:grid-cols-4 gap-4">
                        ${storybook.educational_content.vocabulary.map((vocabItem, idx) => {
                            // vocabulary가 객체 형식인지 문자열인지 확인
                            const word = typeof vocabItem === 'object' ? vocabItem.word : vocabItem;
                            const korean = typeof vocabItem === 'object' ? vocabItem.korean : '';
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
                                            class="text-sm text-gray-500 bg-transparent border-b border-gray-200 focus:border-blue-400 focus:outline-none w-full"
                                            placeholder="한글 뜻"
                                        />` : ''}
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
                
                const result = await generateImageClient(prompt, refImageUrls, 3); // 최대 3회 재시도
                
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
        console.log('📝 프롬프트:', customPrompt.substring(0, 100) + '...');
        if (refImageUrls.length > 0) {
            console.log('🖼️ 참조 이미지:', refImageUrls.length, '개');
        }
        
        const result = await generateImageClient(prompt, refImageUrls, 3); // 최대 3회 재시도

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
                    
                    // 레퍼런스 이미지 수집: 캐릭터만 (병렬이므로 전 페이지 참조 없음)
                    const refImageUrls = characterReferences.map(char => char.referenceImage);
                    
                    const result = await generateImageClient(prompt, refImageUrls, 3); // 최대 3회 재시도
                    
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
                
                // 레퍼런스 이미지 수집: 캐릭터 + 바로 전 페이지
                const refImageUrls = characterReferences.map(char => char.referenceImage);
                
                // ⭐ 바로 전 페이지의 이미지를 자동으로 참조 (연속성 향상)
                if (i > 0) {
                    const previousPage = currentStorybook.pages[i - 1];
                    if (previousPage && previousPage.illustrationImage) {
                        console.log(`📖 페이지 ${page.pageNumber}: 바로 전 페이지(${previousPage.pageNumber})의 이미지를 자동 참조`);
                        refImageUrls.push(previousPage.illustrationImage);
                    }
                }
                
                const result = await generateImageClient(prompt, refImageUrls, 3); // 최대 3회 재시도
                
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
        
        // 레퍼런스 이미지 수집: 캐릭터 + 바로 전 페이지 + 기존 삽화(있으면) + 사용자 선택 참조 이미지
        const refImageUrls = characterReferences.map(char => char.referenceImage);
        
        // ⭐ 새로 추가: 바로 전 페이지의 이미지를 자동으로 참조 (연속성 향상)
        if (pageIndex > 0) {
            const previousPage = currentStorybook.pages[pageIndex - 1];
            if (previousPage && previousPage.illustrationImage) {
                console.log(`📖 바로 전 페이지(${pageIndex})의 이미지를 자동 참조하여 연속성 향상`);
                refImageUrls.push(previousPage.illustrationImage);
            }
        }
        
        // 재생성인 경우 기존 이미지를 레퍼런스로 추가
        if (page.illustrationImage && editNote) {
            console.log('🔄 재생성 모드: 기존 이미지를 레퍼런스로 추가');
            refImageUrls.push(page.illustrationImage);
        }
        
        // 사용자가 선택한 다른 페이지 이미지를 참조로 추가
        const selectedRefImages = getSelectedReferenceImages(pageIndex);
        if (selectedRefImages.length > 0) {
            console.log(`🖼️ ${selectedRefImages.length}개의 참조 이미지 추가 (페이지: ${selectedRefImages.map(img => img.pageNumber).join(', ')})`);
            selectedRefImages.forEach(refImg => {
                refImageUrls.push(refImg.imageUrl);
            });
        }
        
        const result = await generateImageClient(prompt, refImageUrls, 3); // 최대 3회 재시도

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
    const checkboxes = document.querySelectorAll(`input[id^="ref-check-${pageIndex}-"]:checked`);
    
    checkboxes.forEach(checkbox => {
        const refPageIdx = parseInt(checkbox.id.split('-').pop());
        const refPage = currentStorybook.pages[refPageIdx];
        
        if (refPage && refPage.illustrationImage) {
            selectedImages.push({
                pageNumber: refPage.pageNumber,
                imageUrl: refPage.illustrationImage
            });
        }
    });
    
    console.log(`📸 페이지 ${pageIndex + 1} - 선택된 참조 이미지:`, selectedImages.length);
    return selectedImages;
}


// 단어 이미지 생성 - 개별 단어
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
        // 클라이언트에서 직접 Gemini API 호출
        const prompt = `Create a simple, clear educational illustration of: ${word}${korean ? ` (${korean})` : ''}

Requirements:
- Single object or concept clearly shown
- Clean, white background
- High contrast and vibrant colors
- Professional, educational style
- Suitable for children ages 4-8
- Art style: ${currentStorybook.artStyle}

**CRITICAL - NO TEXT:** Do NOT include ANY text, labels, words, letters, or captions in the image. Show ONLY the visual representation of the word.

Example: For "Apple", show only a red apple fruit. No text.`;

        const result = await generateImageClient(prompt, [], 3); // 최대 3회 재시도
        
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
                success: true
            };
            
            saveCurrentStorybook();
            
            // UI만 업데이트 (전체 재렌더링 안 함)
            vocabImgDiv.innerHTML = `<img src="${imageUrl}" alt="${word}" class="w-full h-full object-cover rounded-lg"/>`;
            
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
    // 전체 스토리 맥락 구성 (이전 페이지들)
    let storyContext = '';
    let previousPageNote = '';
    if (currentStorybook && currentStorybook.pages) {
        const previousPages = currentStorybook.pages
            .filter(p => p.pageNumber < page.pageNumber)
            .sort((a, b) => a.pageNumber - b.pageNumber);
        
        if (previousPages.length > 0) {
            console.log(`📖 Including story context from ${previousPages.length} previous pages`);
            const previousTexts = previousPages
                .map(p => `Page ${p.pageNumber}: ${p.text}`)
                .join('\n');
            
            // 바로 전 페이지 강조
            const immediatelyPreviousPage = previousPages[previousPages.length - 1];
            if (immediatelyPreviousPage && immediatelyPreviousPage.illustrationImage) {
                previousPageNote = `\n\n**🎨 PREVIOUS PAGE REFERENCE (Page ${immediatelyPreviousPage.pageNumber}):**
I have provided the illustration from the immediately previous page (Page ${immediatelyPreviousPage.pageNumber}) as a reference image. Use it to maintain visual continuity, consistent lighting, color palette, and art style. The current page should naturally flow from the previous page's visual style and composition.`;
            }
            
            storyContext = `\n\n**STORY CONTEXT - What happened before this scene:**
${previousTexts}

**CURRENT PAGE ${page.pageNumber}:** ${page.text}
${previousPageNote}

**⭐ CRITICAL:** The illustration MUST reflect the current page state. If a character has transformed or changed (e.g., mermaid → human with legs, child → adult, cursed → normal), they MUST appear in their NEW form on the current page, NOT their old form. Consider the full story progression when depicting characters and scenes.`;
        }
    }
    
    let characterInfo = '';
    
    // 캐릭터 레퍼런스 정보 추가
    if (characterReferences && characterReferences.length > 0 && settings.enforceCharacterConsistency) {
        characterInfo = '\n\n**Character References (MUST FOLLOW EXACTLY):**\n';
        characterInfo += 'You have been provided with character reference images. ';
        
        if (settings.enforceCharacterConsistency) {
            characterInfo += '**ABSOLUTE REQUIREMENT:** Recreate each character PIXEL-FOR-PIXEL from the reference images. ';
            characterInfo += 'Match EXACTLY: facial features, body proportions, clothing, colors, hairstyle, and all visual details. ';
            characterInfo += 'The characters in this illustration MUST be visually identical to the reference images.\n\n';
        }
        
        currentStorybook.characters.forEach((char, index) => {
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
    
    // 재생성 안내 (기존 이미지가 있고 수정사항이 있는 경우)
    const regenerationNote = (page.illustrationImage && editNote) ? 
        '\n\n**REGENERATION MODE:** You are provided with the previous version of this illustration as a reference image. Use it to understand the current composition, layout, and style. Then apply the modification request while maintaining consistency with the overall scene.' : 
        '';
    
    const prompt = `Create a beautiful, professional illustration for a children's storybook page.
${storyContext}

**Main Scene Description:** ${page.scene_description}
${sceneDetails}
${characterInfo}
${regenerationNote}
${editNote ? `\n\n**Important Modification Request:** ${editNote}\n**Note:** Apply this modification to the scene while keeping other elements consistent with the reference images.` : ''}

**Art Style:** ${artStyle} style for children's book illustration.

**Image Aspect Ratio:** ${settings.aspectRatio}

**Composition:** Create a warm, inviting scene that captures the emotion and action of the story moment. Use a horizontal composition suitable for a storybook spread.

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
