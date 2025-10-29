document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('cv-form');
    const livePreview = document.getElementById('live-preview');
    const styleSwitch = document.getElementById('style-switch');
    const downloadPdfBtn = document.getElementById('download-pdf');
    const geminiModal = document.getElementById('gemini-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const acceptSuggestionBtn = document.getElementById('accept-suggestion');
    const copySuggestionBtn = document.getElementById('copy-suggestion');
    const profilePicturePreview = document.getElementById('profile-picture-preview');

    // CV Data Structure
    let cvData = {
        personalDetails: {
            name: '',
            email: '',
            phone: '',
            linkedin: '',
            profilePicture: ''
        },
        professionalSummary: '',
        workExperience: [],
        education: [],
        skills: [],
        projects: [],
        certifications: []
    };

    // State for Gemini Modal
    let activeGeminiTargetId = null;
    let geminiSuggestionText = '';

    // --- LOCAL STORAGE ---
    const loadFromLocalStorage = () => {
        const data = localStorage.getItem('cvData');
        if (data) {
            cvData = JSON.parse(data);
            populateForm();
        }
    };

    const saveToLocalStorage = () => {
        localStorage.setItem('cvData', JSON.stringify(cvData));
    };

    // --- FORM POPULATION ---
    const populateForm = () => {
        document.getElementById('name').value = cvData.personalDetails.name;
        document.getElementById('email').value = cvData.personalDetails.email;
        document.getElementById('phone').value = cvData.personalDetails.phone;
        document.getElementById('linkedin').value = cvData.personalDetails.linkedin;
        document.getElementById('summary').value = cvData.professionalSummary;

        if (cvData.personalDetails.profilePicture) {
            profilePicturePreview.style.backgroundImage = `url(${cvData.personalDetails.profilePicture})`;
        }

        // Clear existing dynamic fields before populating
        document.getElementById('experience-entries').innerHTML = '';
        document.getElementById('education-entries').innerHTML = '';
        document.getElementById('skills-entries').innerHTML = '';
        document.getElementById('projects-entries').innerHTML = '';
        document.getElementById('certifications-entries').innerHTML = '';

        // Populate dynamic fields from loaded data
        cvData.workExperience.forEach((item, index) => addEntry('experience', item, index));
        cvData.education.forEach((item, index) => addEntry('education', item, index));
        cvData.skills.forEach((item, index) => addEntry('skill', item, index));
        cvData.projects.forEach((item, index) => addEntry('project', item, index));
        cvData.certifications.forEach((item, index) => addEntry('certification', item, index));
    };

    // --- LIVE PREVIEW ---
    const updatePreview = () => {
        const style = styleSwitch.value;
        const templateId = style === 'professional' ? 'professional-template' : 'modern-template';
        const templateNode = document.getElementById(templateId).cloneNode(true);

        // Helper to safely update text content
        const updateText = (selector, value) => {
            const element = templateNode.querySelector(selector);
            if (element) element.textContent = value || '';
        };

        // Update simple fields
        updateText('.name', cvData.personalDetails.name);
        updateText('.email', cvData.personalDetails.email);
        updateText('.phone', cvData.personalDetails.phone);
        updateText('.linkedin', cvData.personalDetails.linkedin);
        updateText('.summary', cvData.professionalSummary);

        // Update profile picture for modern template
        const img = templateNode.querySelector('.profile-picture');
        if (img && cvData.personalDetails.profilePicture) {
            img.src = cvData.personalDetails.profilePicture;
        }

        // Handle lists
        const experienceList = cvData.workExperience.map(item => `<div><strong>${item.title}</strong> at ${item.company}</div>`).join('');
        const educationList = cvData.education.map(item => `<div><strong>${item.degree}</strong> from ${item.institution}</div>`).join('');
        const skillsList = cvData.skills.map(item => `<li>${item.skill}</li>`).join('');
        const projectsList = cvData.projects.map(item => `<div><strong>${item.name}</strong>: ${item.description}</div>`).join('');
        const certificationsList = cvData.certifications.map(item => `<div>${item.name}</div>`).join('');
        
        templateNode.querySelector('.experience-list').innerHTML = experienceList;
        templateNode.querySelector('.education-list').innerHTML = educationList;
        templateNode.querySelector('.skills-list').innerHTML = skillsList;
        templateNode.querySelector('.projects-list').innerHTML = projectsList;
        templateNode.querySelector('.certifications-list').innerHTML = certificationsList;

        livePreview.innerHTML = templateNode.innerHTML;
        saveToLocalStorage();
    };

    form.addEventListener('input', (e) => {
        const { id, value, dataset } = e.target;
        if (dataset.field) {
            const [section, index, field] = dataset.field.split('-');
            cvData[section][index][field] = value;
        } else if (id in cvData.personalDetails) {
            cvData.personalDetails[id] = value;
        } else {
            cvData[id] = value;
        }
        updatePreview();
    });

    document.getElementById('profile-picture').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target.result;
                cvData.personalDetails.profilePicture = imageUrl;
                profilePicturePreview.style.backgroundImage = `url(${imageUrl})`;
                updatePreview();
            };
            reader.readAsDataURL(file);
        }
    });
    // --- END EVENT LISTENERS ---

    // Helper to get the correct key for the cvData object
    const getCvDataKey = (section) => {
        const keyMap = {
            experience: 'workExperience',
            project: 'projects',
            skill: 'skills',
            education: 'education',
            certification: 'certifications'
        };
        // The key in the map or the section name itself (for education, skills, certifications)
        // The form uses 'workExperience' in data-field, but the add/remove buttons use 'experience'. This handles both.
        return keyMap[section] || section;
    };

    styleSwitch.addEventListener('change', updatePreview);

    downloadPdfBtn.addEventListener('click', () => {
        const element = livePreview;
        const opt = {
            margin: 0.5,
            filename: 'cv.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    });

    // --- GEMINI MODAL LOGIC ---
    document.querySelectorAll('.gemini-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.classList.add('loading');
            btn.textContent = 'Thinking...';

            const targetId = btn.dataset.target;
            activeGeminiTargetId = targetId; // Store the active target
            const text = document.getElementById(targetId).value;
            const prompt = `Act as a professional career coach. Review the following CV section for clarity, impact, and professionalism. Rewrite it to be more compelling and suggest 3-5 bullet points to enhance it. Original text: ${text}`;
            
            // --- Mock API Call ---
            // Replace this with your actual fetch call to the Gemini API backend
            console.log("Calling Gemini API with prompt: ", prompt);
            await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate network delay
            geminiSuggestionText = `As a seasoned professional with a proven track record in software development, I excel at creating robust and scalable applications. My expertise in full-stack development, combined with a passion for clean code and user-centric design, allows me to deliver high-quality solutions that drive business growth.`;
            // --- End Mock API Call ---
            document.getElementById('gemini-suggestions').textContent = geminiSuggestionText;

            geminiModal.style.display = 'block';

            btn.classList.remove('loading');
            btn.textContent = 'Help Me Improve';
        });
    });

    closeModalBtn.addEventListener('click', () => {
        geminiModal.style.display = 'none';
        activeGeminiTargetId = null; // Clear active target
    });

    acceptSuggestionBtn.addEventListener('click', () => {
        if (activeGeminiTargetId && geminiSuggestionText) {
            const targetInput = document.getElementById(activeGeminiTargetId);
            targetInput.value = geminiSuggestionText;
            // Manually trigger an input event to update cvData and the preview
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            geminiModal.style.display = 'none';
            activeGeminiTargetId = null;
        }
    });

    copySuggestionBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(geminiSuggestionText)
            .then(() => alert('Suggestion copied to clipboard!'));
    });

    window.addEventListener('click', (e) => {
        if (e.target == geminiModal) {
            geminiModal.style.display = 'none';
        }
    });
    // --- END GEMINI MODAL LOGIC ---

    // --- DYNAMIC FIELDS LOGIC ---
    const addEntry = (section, data = {}, existingIndex = -1) => {
        const container = document.getElementById(`${section}-entries`);
        const dataKey = getCvDataKey(section);
        const index = existingIndex !== -1 ? existingIndex : cvData[dataKey].length;
        const entry = document.createElement('div');
        entry.classList.add('entry');
        let fields = '';
        const fieldKey = dataKey; // e.g., 'workExperience'

        // Define fields for each section
        switch (section) {
            case 'experience':
                fields = `
                    <input type="text" data-field="${fieldKey}-${index}-title" placeholder="Job Title" value="${data.title || ''}">
                    <input type="text" data-field="${fieldKey}-${index}-company" placeholder="Company" value="${data.company || ''}">
                    <textarea data-field="${fieldKey}-${index}-description" placeholder="Description">${data.description || ''}</textarea>
                `;
                break;
            case 'education':
                fields = `
                    <input type="text" data-field="education-${index}-degree" placeholder="Degree" value="${data.degree || ''}">
                    <input type="text" data-field="education-${index}-institution" placeholder="Institution" value="${data.institution || ''}">
                `;
                break;
            case 'skill':
                fields = `<input type="text" data-field="${fieldKey}-${index}-skill" placeholder="Skill" value="${data.skill || ''}">`;
                break;
            case 'project':
                fields = `
                    <input type="text" data-field="${fieldKey}-${index}-name" placeholder="Project Name" value="${data.name || ''}">
                    <textarea data-field="${fieldKey}-${index}-description" placeholder="Description">${data.description || ''}</textarea>
                `;
                break;
            case 'certification':
                fields = `<input type="text" data-field="${fieldKey}-${index}-name" placeholder="Certification Name" value="${data.name || ''}">`;
                break;
        }

        entry.innerHTML = fields + '<button type="button" class="remove-btn">Remove</button>';
        container.appendChild(entry);

        // If it's a new entry (not from localStorage), add a blank object to cvData
        if (existingIndex === -1) {
            const dataMap = {
                experience: { title: '', company: '', description: '' },
                education: { degree: '', institution: '' },
                skill: { skill: '' },
                project: { name: '', description: '' },
                certification: { name: '' }
            };
            cvData[dataKey].push(dataMap[section]);
        }
    };

    // Add button listeners
    document.getElementById('add-experience').addEventListener('click', () => addEntry('experience'));
    document.getElementById('add-education').addEventListener('click', () => addEntry('education'));
    document.getElementById('add-skill').addEventListener('click', () => addEntry('skill'));
    document.getElementById('add-project').addEventListener('click', () => addEntry('project'));
    document.getElementById('add-certification').addEventListener('click', () => addEntry('certification'));

    form.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const entry = e.target.parentElement;
            const container = entry.parentElement;
            const section = container.id.replace('-entries', '');
            const dataKey = getCvDataKey(section);
            const index = Array.from(container.children).indexOf(entry); // Find index before removing

            cvData[dataKey].splice(index, 1);

            // Re-render form and preview to update indices
            container.innerHTML = '';
            cvData[dataKey].forEach((item, i) => addEntry(section, item, i));
            updatePreview();
        }
    });
    // --- END DYNAMIC FIELDS LOGIC ---

    // Initial Load
    loadFromLocalStorage();
    updatePreview();
});
