export async function setupCustomLanguageHandlers() {
  const languageSelect = document.getElementById('language');
  const targetLanguageSelect = document.getElementById('targetLanguage'); 
  // Ensure custom language input wrapper exists (created by ensureOptionExists)
  const customLanguageInput = document.querySelector('.custom-language-input') || document.getElementById('customLanguageInput');
  // If none exists, create a minimal one to match previous behavior
  if (!customLanguageInput) {
    const cont = document.getElementById('modeOptionsContainer') || document.body;
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-language-input hidden';
    wrapper.id = 'customLanguageInput';
    wrapper.innerHTML = `<input type="text" id="customLanguage" placeholder="Enter custom language name">`;
    cont.appendChild(wrapper);
  }
  const customLanguageField = document.getElementById('customLanguage');

  let lastSelectedStandardLanguage = languageSelect.value;

  const standardLanguages = Array.from(languageSelect.options)
    .filter(option => option.value !== 'custom')
    .map(option => ({ value: option.value, text: option.textContent }));

  function populateLanguageSelect(selectEl, includeCustomOption = false) {
    const optionsToRemove = Array.from(selectEl.options);
    optionsToRemove.forEach(option => option.remove());

    standardLanguages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.value;
      option.textContent = lang.text;
      selectEl.appendChild(option);
    });

    try {
      const localCustomLanguages = JSON.parse(localStorage.getItem('customLanguages')) || [];
      localCustomLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.name.toLowerCase();
        option.textContent = lang.name;
        option.dataset.isCustom = 'true';
        selectEl.appendChild(option);
      });
    } catch (error) {
      console.error("Error reading custom languages from localStorage:", error);
    }

    if (includeCustomOption) {
      const customOption = document.createElement('option');
      customOption.value = 'custom';
      customOption.textContent = '+ Add Custom Language';
      selectEl.appendChild(customOption);

      const clearOption = document.createElement('option');
      clearOption.value = 'clear_languages';
      clearOption.textContent = '🗑️ Clear Saved Languages';
      clearOption.style.color = '#ef4444'; 
      selectEl.appendChild(clearOption);
    }

    if (!Array.from(selectEl.options).some(opt => opt.value === selectEl.value)) {
       selectEl.value = 'javascript'; 
    }
  }

  populateLanguageSelect(languageSelect, true); 
  populateLanguageSelect(targetLanguageSelect, false); 

  if (!targetLanguageSelect.value) {
      targetLanguageSelect.value = 'javascript'; 
  }

  async function handleClearLanguages() {
    const confirmClear = confirm('Are you sure you want to clear all saved custom languages? This cannot be undone.');

    if (confirmClear) {
      try {
        localStorage.removeItem('customLanguages');

        populateLanguageSelect(languageSelect, true);
        populateLanguageSelect(targetLanguageSelect, false);
      } catch (error) {
        console.error('Error clearing custom languages:', error);
        alert('Failed to clear saved languages, Check console for details.');
      }
    }

    languageSelect.value = lastSelectedStandardLanguage;
  }

  languageSelect.addEventListener('change', (e) => {
    if (e.target.value === 'clear_languages') {
      lastSelectedStandardLanguage = Array.from(languageSelect.options)
          .filter(opt => opt.value !== 'clear_languages' && opt.value !== 'custom')
          .find(opt => opt.selected)?.value || 'javascript'; 
      handleClearLanguages();
    } else if (e.target.value === 'custom') {
      customLanguageInput.classList.remove('hidden');
      const currentCustomValue = customLanguageField.value.trim();
      if (currentCustomValue) {
           languageSelect.value = 'custom'; 
      } else {
           lastSelectedStandardLanguage = Array.from(languageSelect.options)
               .filter(opt => opt.value !== 'custom')
               .find(opt => opt.selected)?.value || 'javascript'; 
      }
      customLanguageField.focus();
    } else {
      customLanguageInput.classList.add('hidden');
      lastSelectedStandardLanguage = e.target.value;
    }
  });

  customLanguageField.addEventListener('blur', (e) => {
    const customValue = e.target.value.trim();

    if (!customValue) {
      languageSelect.value = lastSelectedStandardLanguage;
      customLanguageInput.classList.add('hidden');
    }
  });

  customLanguageField.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const customValue = customLanguageField.value.trim();

      if (customValue) {
        const normalizedCustomValue = customValue.toLowerCase();

        const exists = Array.from(languageSelect.options).some(
          option => option.value === normalizedCustomValue
        );

        if (!exists) {
          try {
            const localCustomLanguages = JSON.parse(localStorage.getItem('customLanguages')) || [];
            const isExistsInLocal = localCustomLanguages.some(lang =>
              lang.name.toLowerCase() === normalizedCustomValue
            );

            if (!isExistsInLocal) {
              localCustomLanguages.push({ name: customValue });
              localStorage.setItem('customLanguages', JSON.stringify(localCustomLanguages));
            }

            populateLanguageSelect(languageSelect, true); 
            populateLanguageSelect(targetLanguageSelect, false); 

            languageSelect.value = normalizedCustomValue;
            lastSelectedStandardLanguage = normalizedCustomValue; 

            customLanguageInput.classList.add('hidden');
            customLanguageField.value = '';

          } catch (error) {
             console.error("Error saving custom language:", error);
             alert("Failed to save custom language.");
          }
        } else {
          languageSelect.value = normalizedCustomValue;
          lastSelectedStandardLanguage = normalizedCustomValue; 
          customLanguageInput.classList.add('hidden');
          customLanguageField.value = '';
        }
      } else {
          languageSelect.value = lastSelectedStandardLanguage;
          customLanguageInput.classList.add('hidden');
          customLanguageField.value = '';
      }
    }
  });
}