let currentUser;

function initializeApp() {
  currentUser = localStorage.getItem("currentUser");
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }
  document.getElementById("current-user").textContent = currentUser;
  loadProjects();
  loadMessages();

  const hash = window.location.hash.slice(1) || "pool";
  showTab(hash);
}

function loadProjects() {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  const poolElement = document.getElementById("pool-projects");
  const myEditsElement = document.getElementById("my-edits-projects");
  poolElement.innerHTML = "";
  myEditsElement.innerHTML = "";

  projects.forEach(project => {
    const projectElement = document.createElement("div");
    projectElement.className = "project";
    projectElement.innerHTML = `
      <h3>${project.title}</h3>
      <p>${project.text}</p>
      ${project.editedSample ? `<p><strong>Edited:</strong> ${project.editedSample}</p>` : ""}
      <p><strong>Owner:</strong> ${project.user}</p>
      ${project.user !== currentUser && !project.editedSample ? `<button onclick="claimProject('${project.id}')">Edit this Project</button>` : ""}
      ${project.user === currentUser && !project.editedSample ? `<button onclick="deleteProject('${project.id}')">Delete</button>` : ""}
    `;
    if (project.user !== currentUser && !project.editedSample) {
      poolElement.appendChild(projectElement);
    } else if (project.user === currentUser || project.editedSample) {
      myEditsElement.appendChild(projectElement);
    }
  });
}

function loadMessages() {
  const messages = JSON.parse(localStorage.getItem("messages") || "[]");
  const inboxElement = document.getElementById("inbox-messages");
  inboxElement.innerHTML = "";

  messages.filter(msg => msg.to === currentUser).forEach(msg => {
    const messageElement = document.createElement("div");
    messageElement.className = "message";
    messageElement.innerHTML = `
      <p><strong>From:</strong> ${msg.from}</p>
      <p>${msg.text}</p>
    `;
    inboxElement.appendChild(messageElement);
  });
}

function claimProject(projectId) {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  const project = projects.find(p => p.id === projectId);
  if (project && !project.editedSample) {
    goToEdit(project);
  }
}

function goToEdit(project) {
  sessionStorage.setItem("currentEdit", JSON.stringify(project));
  window.location.href = "edit.html";
}

function deleteProject(projectId) {
  let projects = JSON.parse(localStorage.getItem("projects") || "[]");
  projects = projects.filter(p => p.id !== projectId);
  localStorage.setItem("projects", JSON.stringify(projects));
  loadProjects();
}

function submitProject() {
  const title = document.getElementById("project-title").value;
  const text = document.getElementById("project-text").value;
  if (title && text) {
    const projects = JSON.parse(localStorage.getItem("projects") || "[]");
    const projectId = Date.now().toString();
    projects.push({ id: projectId, title, text, user: currentUser });
    localStorage.setItem("projects", JSON.stringify(projects));
    document.getElementById("project-title").value = "";
    document.getElementById("project-text").value = "";
    loadProjects();
  }
}

function submitMessage() {
  const to = document.getElementById("message-to").value;
  const text = document.getElementById("message-text").value;
  if (to && text) {
    const messages = JSON.parse(localStorage.getItem("messages") || "[]");
    messages.push({ from: currentUser, to, text });
    localStorage.setItem("messages", JSON.stringify(messages));
    document.getElementById("message-to").value = "";
    document.getElementById("message-text").value = "";
    loadMessages();
  }
}

function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
}

function claimEdit(projectId) {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  const project = projects.find(p => p.id === projectId);
  if (project && !project.editedSample) {
    goToEdit(project);
  } else {
    console.log("Project already claimed or not found:", projectId);
  }
}

function renderMyEdits() {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  const myEditsElement = document.getElementById("my-edits-projects");
  myEditsElement.innerHTML = "";

  projects.filter(p => p.user === currentUser || p.editedSample).forEach(project => {
    const projectElement = document.createElement("div");
    projectElement.className = "project";
    projectElement.innerHTML = `
      <h3>${project.title}</h3>
      <p>${project.text}</p>
      ${project.editedSample ? `<p><strong>Edited:</strong> ${project.editedSample}</p>` : ""}
      <p><strong>Owner:</strong> ${project.user}</p>
      ${project.user === currentUser && !project.editedSample ? `<button onclick="deleteProject('${project.id}')">Delete</button>` : ""}
      ${project.user !== currentUser && !project.editedSample ? `<button onclick="claimEdit('${project.id}')">Edit this Project</button>` : ""}
    `;
    myEditsElement.appendChild(projectElement);
  });
}

function renderReview() {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  const reviewElement = document.getElementById("review-projects");
  reviewElement.innerHTML = "";

  projects.filter(p => p.editedSample && p.user === currentUser).forEach(project => {
    const projectElement = document.createElement("div");
    projectElement.className = "project";
    projectElement.innerHTML = `
      <h3>${project.title}</h3>
      <p><strong>Original:</strong> ${project.text}</p>
      <p><strong>Edited:</strong> ${project.editedSample}</p>
      <button onclick="reviewEdit('${project.id}')">Review Edit</button>
    `;
    reviewElement.appendChild(projectElement);
  });
}

function reviewEdit(projectId) {
  const projects = JSON.parse(localStorage.getItem("projects") || "[]");
  const project = projects.find(p => p.id === projectId);
  if (project && project.editedSample) {
    sessionStorage.setItem("currentReview", JSON.stringify(project));
    window.location.href = "review.html";
  }
}

function showTab(tabId) {
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => {
    if (tab) tab.style.display = 'none'; // Null check
  });

  const activeTab = document.getElementById(tabId);
  if (activeTab) {
    activeTab.style.display = 'block';
    console.log("Showing tab:", tabId);
    if (tabId === "my-edits") renderMyEdits(); // Ensure My Edits renders
    if (tabId === "review") renderReview(); // Ensure Review renders
  } else {
    console.warn("Tab not found:", tabId);
    const poolTab = document.getElementById("pool");
    if (poolTab) poolTab.style.display = 'block'; // Fallback
  }

  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
    if (button.dataset.tab === tabId) button.classList.add('active');
  });
}

document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => showTab(button.dataset.tab));
});

document.getElementById("submit-project").addEventListener('click', submitProject);
document.getElementById("submit-message").addEventListener('click', submitMessage);
document.getElementById("logout").addEventListener('click', logout);

initializeApp();