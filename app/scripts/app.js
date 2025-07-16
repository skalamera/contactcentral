let client;

// Global variables
let allContacts = [];
let filteredContacts = [];
let currentTicketRequesterId = null;
let currentTicketCompanyId = null;
let selectedContactIds = new Set();

// Internal contacts variables
let internalContacts = {
  accountManagers: [],
  salesReps: []
};
let selectedInternalIds = new Set();

// Contact mappings
const ACCOUNT_MANAGER_EMAILS = {
  "Audrey Stumpp": "astumpp@benchmarkeducation.com",
  "Julie Tangeman": "Jtangeman@benchmarkeducation.com",
  "Margie Codella": "mcodella@benchmarkeducation.com",
  "Michelle Susi": "MSusi@benchmarkeducation.com",
  "Sue Wick-Krch": "swickkrch@benchmarkeducation.com",
  "Christina Fabiano": "cfabiano@benchmarkeducation.com",
  "Jamie Garcia": "Jgarcia@benchmarkeducation.com",
  "George Schnur": "gschnur@benchmarkeducation.com",
  "Stacy Chu": "Schu@benchmarkeducation.com",
  "Zach Oliver": "zoliver@benchmarkeducation.com",
  "Juliana Abouraad": "jabouraad@benchmarkeducation.com"
};

const SALES_REP_EMAILS = {
  "Tosha Kirkham": "tkirkham@benchmarkeducation.com",
  "Kyle Koon": "KKoon@benchmarkeducation.com",
  "Mary Russick": "mrussick@benchmarkeducation.com",
  "Heather Mooney": "HMooney@benchmarkeducation.com",
  "Vivian Cheng": "VCheng@benchmarkeducation.com",
  "Margie Codella": "mcodella@benchmarkeducation.com"
};

(async function init() {
  try {
    client = await app.initialized();
    console.log("App initialized successfully");

    client.events.on('app.activated', onAppActivated);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to initialize the app');
  }
})();

function onAppActivated() {
  try {
    console.log("App activated, loading contacts...");
    loadInternalContacts();
    loadSpecialRoleContacts();
  } catch (error) {
    console.error('Error during app activation:', error);
    showError('Error during app activation');
  }
}

async function loadInternalContacts() {
  try {
    console.log("Loading internal contacts...");

    // Get ticket data for account manager and sales rep info
    let accountManager = null;
    let salesRep = null;

    try {
      const ticketData = await client.data.get('ticket');
      accountManager = ticketData?.ticket?.custom_fields?.cf_account_manager || null;
      salesRep = ticketData?.ticket?.custom_fields?.cf_rvp || null;

      console.log("Account Manager from ticket:", accountManager);
      console.log("Sales Rep from ticket:", salesRep);
    } catch (error) {
      console.log("No ticket context available for internal contacts:", error);
    }

    // Build internal contacts arrays
    internalContacts.accountManagers = [];
    internalContacts.salesReps = [];

    if (accountManager && ACCOUNT_MANAGER_EMAILS[accountManager]) {
      internalContacts.accountManagers.push({
        id: `am_${accountManager.replace(/\s+/g, '_')}`,
        name: accountManager,
        email: ACCOUNT_MANAGER_EMAILS[accountManager],
        type: 'account_manager'
      });
    }

    if (salesRep && SALES_REP_EMAILS[salesRep]) {
      internalContacts.salesReps.push({
        id: `sr_${salesRep.replace(/\s+/g, '_')}`,
        name: salesRep,
        email: SALES_REP_EMAILS[salesRep],
        type: 'sales_rep'
      });
    }

    console.log("Internal contacts loaded:", internalContacts);
    displayInternalContacts();

  } catch (error) {
    console.error('Error loading internal contacts:', error);
    showInternalError('Error loading internal contacts: ' + error.message);
  }
}

async function loadSpecialRoleContacts() {
  try {
    // Get ticket data for requester and company info
    let requesterId = null;
    let companyId = null;

    try {
      const ticketData = await client.data.get('ticket');
      requesterId = ticketData?.ticket?.requester_id || null;
      companyId = ticketData?.ticket?.company_id || null;
      currentTicketRequesterId = requesterId;
      currentTicketCompanyId = companyId;
      console.log("Ticket requester ID:", requesterId);
      console.log("Ticket company ID:", companyId);
    } catch (error) {
      console.log("No ticket context available:", error);
    }

    // Fetch all contacts for the company
    const contacts = await fetchAllContactsForCompany(companyId);

    // Filter for only rostering contacts and primary tech roles
    const specialRoleContacts = contacts.filter(contact => {
      const role = contact.custom_fields?.district_role || '';
      const roleLower = role.toLowerCase();
      return roleLower.includes('rostering contact') || roleLower.includes('primary tech');
    });

    console.log(`Found ${specialRoleContacts.length} special role contacts out of ${contacts.length} total contacts`);

    allContacts = specialRoleContacts;
    filteredContacts = specialRoleContacts;

    // Populate school filter options
    populateSchoolFilter();

    // Display the contacts
    displayContacts();

  } catch (error) {
    console.error('Error loading contacts:', error);
    showError('Error loading contacts: ' + error.message);
  }
}

async function fetchAllContactsForCompany(companyId) {
  let allCompanyContacts = [];
  let page = 1;
  const perPage = 100;
  let hasMorePages = true;

  console.log('Fetching contacts for company:', companyId);

  while (hasMorePages) {
    try {
      updateLoadingMessage(`Loading contacts... (Page ${page})`);

      const queryParams = companyId
        ? {
          "company_id": companyId,
          "per_page": perPage,
          "page": page
        }
        : {
          "per_page": perPage,
          "page": page
        };

      const contactsResponse = await client.request.invokeTemplate("getCompanyContacts", {
        "context": {},
        "query": queryParams
      });

      if (contactsResponse?.response) {
        const pageContacts = JSON.parse(contactsResponse.response);

        if (pageContacts && pageContacts.length > 0) {
          allCompanyContacts = allCompanyContacts.concat(pageContacts);
          console.log(`Page ${page}: Found ${pageContacts.length} contacts`);

          if (pageContacts.length < perPage) {
            hasMorePages = false;
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }

      // Small delay to prevent API overload
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasMorePages = false;
    }
  }

  console.log(`Total contacts fetched: ${allCompanyContacts.length}`);
  return allCompanyContacts;
}

function populateSchoolFilter() {
  const schools = [...new Set(allContacts
    .map(contact => contact.custom_fields?.school)
    .filter(school => school && school.trim() !== ''))]
    .sort();

  const schoolFilter = document.getElementById('schoolFilter');
  schoolFilter.innerHTML = '<option value="">All Schools</option>';

  schools.forEach(school => {
    const option = document.createElement('option');
    option.value = school;
    option.textContent = school;
    schoolFilter.appendChild(option);
  });
}

function displayInternalContacts() {
  const internalContent = document.getElementById('internalContent');

  const totalInternal = internalContacts.accountManagers.length + internalContacts.salesReps.length;

  if (totalInternal === 0) {
    internalContent.innerHTML = `
      <div class="empty-state">
        <div class="icon">👤</div>
        <h3>No Internal Contacts Found</h3>
        <p>No Account Manager or Sales Rep assigned to this ticket.</p>
      </div>
    `;
    return;
  }

  let html = '<div class="internal-groups-container">';

  // Account Managers Group
  if (internalContacts.accountManagers.length > 0) {
    html += `
      <div class="internal-group">
        <div class="internal-group-header">
          <h3 class="internal-group-title">Account Managers</h3>
        </div>
        <div class="internal-contacts-list">
          ${internalContacts.accountManagers.map(contact => createInternalContactItem(contact)).join('')}
        </div>
      </div>
    `;
  }

  // Sales Reps Group
  if (internalContacts.salesReps.length > 0) {
    html += `
      <div class="internal-group">
        <div class="internal-group-header">
          <h3 class="internal-group-title">Sales Representatives</h3>
        </div>
        <div class="internal-contacts-list">
          ${internalContacts.salesReps.map(contact => createInternalContactItem(contact)).join('')}
        </div>
      </div>
    `;
  }

  // Global actions for internal section
  html += `
    <div class="internal-actions">
      <button class="internal-check-all-global" onclick="toggleAllInternal()">
        Check All Internal
      </button>
    </div>
  `;

  html += '</div>';
  internalContent.innerHTML = html;

  updateGlobalSelectionUI();
}

function createInternalContactItem(contact) {
  const isSelected = selectedInternalIds.has(contact.id);

  return `
    <div class="internal-contact-item ${isSelected ? 'selected' : ''}" onclick="toggleInternalContact('${contact.id}')">
      <input type="checkbox" 
             class="internal-contact-checkbox" 
             id="internal-checkbox-${contact.id}"
             ${isSelected ? 'checked' : ''}
             onclick="event.stopPropagation()"
             onchange="handleInternalCheckboxChange('${contact.id}', this)">
      <span class="internal-contact-name">${contact.name}</span>
      <span class="internal-contact-email">${contact.email}</span>
    </div>
  `;
}

function displayContacts() {
  const filtersSection = document.getElementById('filtersSection');
  const statsBar = document.getElementById('statsBar');
  const contentDiv = document.getElementById('contactsContent');

  if (filteredContacts.length === 0) {
    // Check if this is because of filtering or genuinely no contacts
    const hasContacts = allContacts.length > 0;

    if (hasContacts) {
      // Keep filters visible when filtering results in no matches
      filtersSection.style.display = 'block';
      statsBar.style.display = 'block';
      statsBar.textContent = 'No contacts match the current filters';
      contentDiv.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔍</div>
          <h3>No Contacts Match Your Filters</h3>
          <p>Try adjusting the role or school filters above to see more contacts.</p>
        </div>
      `;
    } else {
      // Hide filters only when there truly are no contacts at all
      filtersSection.style.display = 'none';
      statsBar.style.display = 'none';
      contentDiv.innerHTML = `
        <div class="empty-state">
          <div class="icon">👥</div>
          <h3>No Special Role Contacts Found</h3>
          <p>This company has no Rostering Contacts or Primary Tech contacts.</p>
        </div>
      `;
    }
    updateGlobalSelectionUI();
    return;
  }

  // Show filters and stats
  filtersSection.style.display = 'block';
  statsBar.style.display = 'block';

  // Update stats
  const rosteringCount = filteredContacts.filter(c =>
    c.custom_fields?.district_role?.toLowerCase().includes('rostering contact')
  ).length;
  const primaryTechCount = filteredContacts.filter(c =>
    c.custom_fields?.district_role?.toLowerCase().includes('primary tech')
  ).length;

  statsBar.textContent = `Showing ${filteredContacts.length} contact${filteredContacts.length !== 1 ? 's' : ''}: ${rosteringCount} Rostering Contact${rosteringCount !== 1 ? 's' : ''}, ${primaryTechCount} Primary Tech${primaryTechCount !== 1 ? 's' : ''}`;

  // Separate requester from other contacts
  let requesterContact = null;
  let otherContacts = [];

  if (currentTicketRequesterId) {
    requesterContact = filteredContacts.find(contact =>
      parseInt(contact.id) === parseInt(currentTicketRequesterId)
    );
    otherContacts = filteredContacts.filter(contact =>
      parseInt(contact.id) !== parseInt(currentTicketRequesterId)
    );
  } else {
    otherContacts = [...filteredContacts];
  }

  // Sort other contacts alphabetically by name
  otherContacts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Build the HTML
  let html = '<div class="contacts-container">';

  // Requester section
  if (requesterContact) {
    html += `
      <div class="requester-section">
        <div class="contacts-container">
          ${createContactCard(requesterContact)}
        </div>
      </div>
    `;
  } else if (currentTicketRequesterId) {
    // Show message if requester is not in the filtered results
    const roleFilter = document.getElementById('roleFilter').value;
    let message = '';

    if (roleFilter === 'rostering contact') {
      message = '🎫 Ticket requester is not a Rostering Contact';
    } else if (roleFilter === 'primary tech') {
      message = '🎫 Ticket requester is not a Primary Tech';
    } else {
      message = '🎫 Ticket requester is not a Rostering Contact or Primary Tech';
    }

    html += `
      <div class="no-requester-message">
        ${message}
      </div>
    `;
  }

  // Add separator if we have other contacts
  if (otherContacts.length > 0) {
    html += `
      <div class="section-separator">
        <h3>Additional Rostering Contacts/Primary Tech's</h3>
      </div>
      <div class="contacts-container">
        ${otherContacts.map(contact => createContactCard(contact)).join('')}
      </div>
    `;
  }

  html += '</div>';

  contentDiv.innerHTML = html;

  // Update UI based on selections
  updateSelectionUI();
  updateGlobalSelectionUI();
}

function createContactCard(contact) {
  const id = contact.id;
  const name = contact.name || 'N/A';
  const email = contact.email || 'N/A';
  const role = contact.custom_fields?.district_role || '';
  const school = contact.custom_fields?.school || 'N/A';

  const isRequester = currentTicketRequesterId && parseInt(id) === parseInt(currentTicketRequesterId);
  const isRosteringContact = role.toLowerCase().includes('rostering contact');
  const isPrimaryTech = role.toLowerCase().includes('primary tech');
  const isSelected = selectedContactIds.has(id);

  // Check if email is valid
  const hasValidEmail = email && email !== 'N/A' && email.includes('@');

  const cardClasses = `contact-card${isRequester ? ' ticket-requester' : ''}${isSelected ? ' selected' : ''}`;
  const roleClass = isPrimaryTech ? 'role-badge primary-tech' : 'role-badge';

  return `
    <div class="${cardClasses}" onclick="toggleContactSelection('${id}', event)">
      ${isRequester ? '<div class="ticket-requester-badge">🎫 TICKET REQUESTER</div>' : ''}
      ${!isRequester ? `
        <input type="checkbox" 
               class="contact-checkbox" 
               id="checkbox-${id}"
               ${isSelected ? 'checked' : ''}
               onclick="event.stopPropagation()"
               onchange="handleCheckboxChange('${id}', this)">
      ` : ''}
      <div class="contact-content">
        <div class="contact-header">
          <h3 class="contact-name">${name}</h3>
          <span class="${roleClass}">${isRosteringContact ? 'Rostering Contact' : 'Primary Tech'}</span>
        </div>
        <div class="contact-detail">
          <span class="icon">${hasValidEmail ? '✉️' : '⚠️'}</span>
          <span style="${!hasValidEmail ? 'color: #999; font-style: italic;' : ''}">${email}</span>
        </div>
        <div class="contact-detail">
          <span class="icon">🏫</span>
          <span>${school}</span>
        </div>
      </div>
    </div>
  `;
}

function handleCheckboxChange(contactId, checkbox) {
  const idStr = String(contactId); // Ensure ID is a string
  if (checkbox.checked) {
    selectedContactIds.add(idStr);
  } else {
    selectedContactIds.delete(idStr);
  }

  // Update the card's selected state
  const card = checkbox.closest('.contact-card');
  if (card) {
    if (checkbox.checked) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  }

  updateSelectionUI();
  updateGlobalSelectionUI();
}

function toggleContactSelection(contactId, event) {
  // Don't toggle if clicking on checkbox or if it's the requester
  if (event.target.type === 'checkbox' ||
    (currentTicketRequesterId && parseInt(contactId) === parseInt(currentTicketRequesterId))) {
    return;
  }

  const checkbox = document.getElementById(`checkbox-${contactId}`);
  if (checkbox && !checkbox.disabled) {
    checkbox.checked = !checkbox.checked;

    if (checkbox.checked) {
      selectedContactIds.add(contactId);
    } else {
      selectedContactIds.delete(contactId);
    }

    updateSelectionUI();
    updateGlobalSelectionUI();
  }
}

function toggleCheckAll() {
  const checkAllBtn = document.getElementById('checkAllBtn');
  const isCheckingAll = checkAllBtn.textContent === 'Check All';

  // Get all non-requester contacts
  const selectableContacts = filteredContacts.filter(contact =>
    !currentTicketRequesterId || parseInt(contact.id) !== parseInt(currentTicketRequesterId)
  );

  if (isCheckingAll) {
    // Check all selectable contacts
    selectableContacts.forEach(contact => {
      selectedContactIds.add(String(contact.id)); // Ensure ID is stored as string
      const checkbox = document.getElementById(`checkbox-${contact.id}`);
      if (checkbox) {
        checkbox.checked = true;
      }
      // Update card selected state
      const card = document.querySelector(`.contact-card[onclick*="${contact.id}"]`);
      if (card && !card.classList.contains('ticket-requester')) {
        card.classList.add('selected');
      }
    });
  } else {
    // Uncheck all
    selectedContactIds.clear();
    document.querySelectorAll('.contact-checkbox:not(:disabled)').forEach(checkbox => {
      checkbox.checked = false;
    });
    // Remove selected class from all cards
    document.querySelectorAll('.contact-card.selected').forEach(card => {
      card.classList.remove('selected');
    });
  }

  // Update UI without re-rendering
  updateSelectionUI();
  updateGlobalSelectionUI();
}

function updateSelectionUI() {
  const checkAllBtn = document.getElementById('checkAllBtn');

  // Update check all button text
  const selectableContacts = filteredContacts.filter(contact =>
    !currentTicketRequesterId || parseInt(contact.id) !== parseInt(currentTicketRequesterId)
  );
  const allChecked = selectableContacts.length > 0 &&
    selectableContacts.every(contact => selectedContactIds.has(String(contact.id)));

  if (checkAllBtn) {
    checkAllBtn.textContent = allChecked ? 'Uncheck All' : 'Check All';
  }

  // Sync checkbox states with selectedContactIds
  filteredContacts.forEach(contact => {
    const checkbox = document.getElementById(`checkbox-${contact.id}`);
    const card = document.querySelector(`.contact-card[onclick*="${contact.id}"]`);
    const isSelected = selectedContactIds.has(String(contact.id));

    if (checkbox) {
      checkbox.checked = isSelected;
    }

    if (card) {
      if (isSelected) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    }
  });
}

function updateGlobalSelectionUI() {
  const floatingCcButton = document.getElementById('floatingCcButton');
  const globalAddToCcBtn = document.getElementById('globalAddToCcBtn');

  const totalSelected = selectedContactIds.size + selectedInternalIds.size;

  if (totalSelected > 0) {
    // Show the floating button with animation
    if (floatingCcButton.style.display === 'none') {
      floatingCcButton.style.display = 'block';
      floatingCcButton.classList.remove('hiding');
    }
    const buttonText = globalAddToCcBtn.querySelector('.button-text');
    if (buttonText) {
      buttonText.textContent = `Add ${totalSelected} Contact${totalSelected !== 1 ? 's' : ''} to CC List`;
    } else {
      globalAddToCcBtn.textContent = `Add ${totalSelected} Contact${totalSelected !== 1 ? 's' : ''} to CC List`;
    }
  } else {
    // Hide the floating button with animation
    if (floatingCcButton.style.display !== 'none') {
      floatingCcButton.classList.add('hiding');
      setTimeout(() => {
        floatingCcButton.style.display = 'none';
        floatingCcButton.classList.remove('hiding');
      }, 300); // Match the animation duration
    }
  }
}

// Section toggle functions
function toggleSection(sectionName) {
  const section = document.getElementById(`${sectionName}Section`);
  const toggle = document.getElementById(`${sectionName}Toggle`);

  if (section.classList.contains('collapsed')) {
    section.classList.remove('collapsed');
    toggle.classList.remove('collapsed');
    toggle.textContent = '▼';
  } else {
    section.classList.add('collapsed');
    toggle.classList.add('collapsed');
    toggle.textContent = '▶';
  }
}

// Internal contact handlers
function handleInternalCheckboxChange(contactId, checkbox) {
  if (checkbox.checked) {
    selectedInternalIds.add(contactId);
  } else {
    selectedInternalIds.delete(contactId);
  }

  // Update the item's selected state
  const item = checkbox.closest('.internal-contact-item');
  if (item) {
    if (checkbox.checked) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  }

  updateInternalGroupButtons();
  updateGlobalSelectionUI();
}

function toggleInternalContact(contactId) {
  const checkbox = document.getElementById(`internal-checkbox-${contactId}`);
  if (checkbox) {
    checkbox.checked = !checkbox.checked;
    handleInternalCheckboxChange(contactId, checkbox);
  }
}



function toggleAllInternal() {
  const allInternalContacts = [...internalContacts.accountManagers, ...internalContacts.salesReps];
  const allSelected = allInternalContacts.every(contact => selectedInternalIds.has(contact.id));

  allInternalContacts.forEach(contact => {
    const checkbox = document.getElementById(`internal-checkbox-${contact.id}`);
    const item = document.querySelector(`.internal-contact-item[onclick*="${contact.id}"]`);

    if (allSelected) {
      // Uncheck all
      selectedInternalIds.delete(contact.id);
      if (checkbox) checkbox.checked = false;
      if (item) item.classList.remove('selected');
    } else {
      // Check all
      selectedInternalIds.add(contact.id);
      if (checkbox) checkbox.checked = true;
      if (item) item.classList.add('selected');
    }
  });

  updateInternalGroupButtons();
  updateGlobalSelectionUI();
}

function updateInternalGroupButtons() {
  // Update global internal button
  const globalButton = document.querySelector('.internal-check-all-global');
  const allInternalContacts = [...internalContacts.accountManagers, ...internalContacts.salesReps];
  const allInternalSelected = allInternalContacts.length > 0 && allInternalContacts.every(contact => selectedInternalIds.has(contact.id));
  if (globalButton) {
    globalButton.textContent = allInternalSelected ? 'Uncheck All Internal' : 'Check All Internal';
  }
}

function applyFilters() {
  const roleFilter = document.getElementById('roleFilter').value.toLowerCase();
  const schoolFilter = document.getElementById('schoolFilter').value;

  filteredContacts = allContacts.filter(contact => {
    const role = (contact.custom_fields?.district_role || '').toLowerCase();
    const school = contact.custom_fields?.school || '';

    const roleMatch = !roleFilter || role.includes(roleFilter);
    const schoolMatch = !schoolFilter || school === schoolFilter;

    return roleMatch && schoolMatch;
  });

  displayContacts();
}

async function addSelectedToCC() {
  try {
    const globalAddToCcBtn = document.getElementById('globalAddToCcBtn');
    globalAddToCcBtn.disabled = true;

    const buttonText = globalAddToCcBtn.querySelector('.button-text');
    if (buttonText) {
      buttonText.textContent = 'Adding to CC...';
    } else {
      globalAddToCcBtn.textContent = 'Adding to CC...';
    }

    // Get selected contact emails from both internal and external
    const selectedEmails = [];
    const invalidContacts = [];

    // Process external contacts
    selectedContactIds.forEach(contactId => {
      const contact = allContacts.find(c => String(c.id) === String(contactId));
      if (contact) {
        console.log('Processing external contact:', contact.name, 'Email:', contact.email);
        if (contact.email && contact.email !== 'N/A' && contact.email.includes('@')) {
          selectedEmails.push(contact.email);
        } else {
          invalidContacts.push({
            name: contact.name || 'Unknown',
            reason: !contact.email ? 'No email' : contact.email === 'N/A' ? 'Email is N/A' : 'Invalid email format'
          });
        }
      } else {
        console.error('External contact not found for ID:', contactId);
      }
    });

    // Process internal contacts
    selectedInternalIds.forEach(contactId => {
      const allInternalContacts = [...internalContacts.accountManagers, ...internalContacts.salesReps];
      const contact = allInternalContacts.find(c => c.id === contactId);
      if (contact) {
        console.log('Processing internal contact:', contact.name, 'Email:', contact.email);
        if (contact.email && contact.email.includes('@')) {
          selectedEmails.push(contact.email);
        } else {
          invalidContacts.push({
            name: contact.name || 'Unknown',
            reason: !contact.email ? 'No email' : 'Invalid email format'
          });
        }
      } else {
        console.error('Internal contact not found for ID:', contactId);
      }
    });

    console.log('Selected emails:', selectedEmails);
    console.log('Invalid contacts:', invalidContacts);

    if (selectedEmails.length === 0) {
      let errorMessage = 'No valid email addresses found';
      if (invalidContacts.length > 0) {
        errorMessage += '\n\nInvalid contacts:\n';
        invalidContacts.forEach(c => {
          errorMessage += `• ${c.name}: ${c.reason}\n`;
        });
      }
      showNotification(errorMessage, 'error');
      return;
    }

    const ccEmails = selectedEmails.join('; ');
    console.log('Adding to CC:', ccEmails);

    // First, copy emails to clipboard as a fallback
    let clipboardSuccess = false;
    try {
      clipboardSuccess = await copyToClipboard(ccEmails);
      console.log('Clipboard copy result:', clipboardSuccess);
    } catch (clipError) {
      console.error('Clipboard copy error:', clipError);
    }

    try {
      // Try to trigger reply and set CC before closing modal
      console.log('Attempting to trigger reply...');
      await client.interface.trigger("click", { id: "reply" });
      console.log('Reply triggered, waiting...');

      // Wait for reply editor to open
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Try to set CC field - Freshdesk expects an array!
      console.log('Attempting to set CC field with array:', selectedEmails);
      await client.interface.trigger("setValue", {
        id: "cc",
        value: selectedEmails  // Pass array instead of string
      });
      console.log('CC field set successfully');

      // Close modal after successful CC set
      await client.instance.close();
      console.log('Modal closed after successful CC set');

      showNotification(`Added ${selectedEmails.length} contact${selectedEmails.length !== 1 ? 's' : ''} to CC`, 'success');

    } catch (error) {
      console.error('Error during reply/CC operation:', error);

      // Try alternative methods with different formats
      let ccSetSuccessful = false;

      // If reply editor is already open, just try to set CC directly
      if (error.message && error.message.includes('reply') && error.message.includes('already open')) {
        console.log('Reply editor already open, trying to set CC directly...');
        try {
          await client.interface.trigger("setValue", {
            id: "cc",
            value: selectedEmails  // Use array format
          });
          ccSetSuccessful = true;
          console.log('CC set successful with already open editor');
        } catch (ccError) {
          console.error('Direct CC set failed:', ccError);
        }
      }

      // Try setting with selector instead of id
      if (!ccSetSuccessful) {
        try {
          console.log('Trying alternative CC set with selector...');
          await client.interface.trigger("setValue", {
            selector: "[name='cc']",
            value: selectedEmails  // Use array format
          });
          ccSetSuccessful = true;
          console.log('Alternative CC set successful');
        } catch (altError) {
          console.error('Alternative selector failed:', altError);

          // Try one more selector option
          try {
            console.log('Trying CC set with cc_email selector...');
            await client.interface.trigger("setValue", {
              selector: "#cc_email",
              value: selectedEmails  // Use array format
            });
            ccSetSuccessful = true;
            console.log('cc_email selector successful');
          } catch (ccEmailError) {
            console.error('cc_email selector also failed:', ccEmailError);
          }
        }
      }

      // Close modal
      try {
        await client.instance.close();
      } catch (closeError) {
        console.error('Error closing modal:', closeError);
      }

      if (ccSetSuccessful) {
        showNotification(`Added ${selectedEmails.length} contact${selectedEmails.length !== 1 ? 's' : ''} to CC`, 'success');
      } else if (clipboardSuccess) {
        showNotification(
          `Copied ${selectedEmails.length} email${selectedEmails.length !== 1 ? 's' : ''} to clipboard.\n\nPlease:\n1. Click in the CC field\n2. Paste (Ctrl+V or Cmd+V)`,
          'info'
        );
      } else {
        // Show emails in a format they can manually copy
        showNotification(
          `Unable to automatically add to CC.\n\nEmails to copy:\n${ccEmails}\n\nPlease copy these emails and paste in the CC field.`,
          'warning'
        );
      }
    }

  } catch (error) {
    console.error('Error in addSelectedToCC:', error);
    showNotification('Error processing contacts. Please try again.', 'error');
  } finally {
    const globalAddToCcBtn = document.getElementById('globalAddToCcBtn');
    if (globalAddToCcBtn) {
      globalAddToCcBtn.disabled = false;
      updateGlobalSelectionUI();
    }
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback method
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (e) {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

function showNotification(message, type) {
  try {
    if (client && client.interface) {
      // Map our types to Freshdesk's expected types
      const freshdeskType = type === 'error' ? 'danger' : type === 'warning' ? 'warning' : type;

      client.interface.trigger("showNotify", {
        type: freshdeskType,
        title: type === 'success' ? "Success" : type === 'error' ? "Error" : type === 'warning' ? "Warning" : "Info",
        message: message
      });
    }
  } catch (error) {
    console.log('Notification failed, using fallback');
    // Fallback notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      white-space: pre-line;
      max-width: 400px;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000); // Increased timeout for longer messages
  }
}

function updateLoadingMessage(message) {
  const contentDiv = document.getElementById('contactsContent');
  if (contentDiv.querySelector('.loading-state')) {
    contentDiv.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  }
}

function showError(message) {
  const contentDiv = document.getElementById('contactsContent');
  contentDiv.innerHTML = `
    <div class="empty-state">
      <div class="icon">⚠️</div>
      <h3>Error</h3>
      <p>${message}</p>
    </div>
  `;
}

function showInternalError(message) {
  const internalContent = document.getElementById('internalContent');
  internalContent.innerHTML = `
    <div class="empty-state">
      <div class="icon">⚠️</div>
      <h3>Error</h3>
      <p>${message}</p>
    </div>
  `;
}