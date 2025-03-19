// Global state
const state = {
  users: JSON.parse(localStorage.getItem("users")) || {},
  sharedProjects: JSON.parse(localStorage.getItem("sharedProjects")) || [],
  currentUser: null,
  editedProjects: [],
  userPoints: 100,
  editTimer: null
};

console.log("Script loaded");

// Utility functions
const utils = {
  saveUserData() {
    state.users[state.currentUser] = {
      password: state.users[state.currentUser].password,
      points: state.userPoints,
      editedProjects: state.editedProjects,
      inbox: state.users[state.currentUser].inbox || [],
      expiredProjects: state.users[state.currentUser].expiredProjects || []
    };
    localStorage.setItem("users", JSON.stringify(state.users));
    localStorage.setItem("sharedProjects", JSON.stringify(state.sharedProjects));
  },

  sendMessage(username, message, editIndex = null) {
    state.users[username].inbox = state.users[username].inbox || [];
    state.users[username].inbox.push({ date: new Date().toLocaleString(), message, editIndex });
    if (username === state.currentUser) ui.displayInbox();
    utils.saveUserData();
  },

  loadUserData() {
    console.log("Loading user data for:", state.currentUser);
    state.userPoints = state.users[state.currentUser].points || 100;
    state.editedProjects = state.users[state.currentUser].editedProjects || [];
    document.getElementById("currentUser").textContent = state.currentUser;
  }
};

// UI-related functions
const ui = {
  updatePointsDisplay() {
    console.log("Updating points display");
    document.getElementById("points").textContent = state.userPoints;
    utils.saveUserData();
  },

  displayProjects() {
    console.log("Displaying projects");
    const projectList = document.getElementById("projectList");
    projectList.innerHTML = "";
    state.sharedProjects
      .filter(project => project.status !== "done")
      .sort((a, b) => (b.ratingTotal / (b.ratingCount || 1)) - (a.ratingTotal / (a.ratingCount || 1)))
      .forEach((project, index) => {
        project.takenBy = project.takenBy || [];
        const avgRating = project.ratingCount ? (project.ratingTotal / project.ratingCount).toFixed(1) : "N/A";
        const takersLeft = project.maxTakers - project.takenBy.length;
        const isClaimedByUser = project.takenBy.includes(state.currentUser);
        const canClaim = takersLeft > 0 && 
                         project.owner !== state.currentUser && 
                         !isClaimedByUser && 
                         (!state.users[state.currentUser]?.expiredProjects || 
                          !state.users[state.currentUser].expiredProjects.includes(project.title));
        console.log(`Project: ${project.title}, Can Claim: ${canClaim}, Takers Left: ${takersLeft}, Owner: ${project.owner}, Current User: ${state.currentUser}`);
        projectList.innerHTML += `
          <li>
            <strong>${project.title}</strong> - ${project.summary} (Avg Popularity: ${avgRating}, Type: ${project.editType}, Takers Left: ${takersLeft})<br>
            ${project.text.substring(0, 100)}... 
            ${isClaimedByUser ? "<span>Claimed</span>" : (canClaim ? `<button onclick="actions.claimProject(${index})">Claim (5 points)</button>` : "")}
          </li>`;
      });
  },

  displaySubmittedProjects() {
    console.log("Displaying submitted projects");
    const submittedList = document.getElementById("submittedProjects");
    submittedList.innerHTML = "";
    const seenEdits = new Set();
    state.sharedProjects
      .filter(project => project.owner === state.currentUser && project.status !== "done" && project.edits.length === 0)
      .forEach((project, index) => {
        const avgRating = project.ratingCount ? (project.ratingTotal / project.ratingCount).toFixed(1) : "N/A";
        const takersLeft = project.maxTakers - (project.takenBy?.length || 0);
        const status = `${takersLeft} Takers Left`;
        submittedList.innerHTML += `
          <li>
            <strong>${project.title}</strong> - ${project.summary} (Avg Popularity: ${avgRating}, Type: ${project.editType}, Status: ${status})<br>
            ${project.text.substring(0, 100)}...
          </li>`;
      });
  },

  displayCompletedEdits() {
    console.log("Displaying completed edits for review");
    const completedList = document.getElementById("completedEdits");
    completedList.innerHTML = "";
    const seenEdits = new Set();
    state.sharedProjects
      .filter(project => project.owner === state.currentUser && project.status !== "done" && project.edits.length > 0)
      .forEach((project, index) => {
        const avgRating = project.ratingCount ? (project.ratingTotal / project.ratingCount).toFixed(1) : "N/A";
        const takersLeft = project.maxTakers - (project.takenBy?.length || 0);
        const status = `${takersLeft} Takers Left`;
        let editButtons = "";
        project.edits.forEach((edit, editIndex) => {
          const editKey = `${edit.editor}-${edit.editedSample}`;
          if (!seenEdits.has(editKey)) {
            seenEdits.add(editKey);
            editButtons += `<button onclick="actions.viewEdit(${index}, ${editIndex})">View Edit by ${edit.editor}</button>`;
          }
        });
        completedList.innerHTML += `
          <li>
            <strong>${project.title}</strong> - ${project.summary} (Avg Popularity: ${avgRating}, Type: ${project.editType}, Status: ${status})<br>
            ${project.text.substring(0, 100)}... ${editButtons}
          </li>`;
      });
  },

  displayArchivedProjects() {
    console.log("Displaying archived projects");
    const archivedList = document.getElementById("archivedProjects");
    archivedList.innerHTML = "";
    state.sharedProjects
      .filter(project => project.owner === state.currentUser && project.status === "done")
      .forEach((project, index) => {
        const avgRating = project.ratingCount ? (project.ratingTotal / project.ratingCount).toFixed(1) : "N/A";
        let editButtons = "";
        project.acceptedEdits = project.acceptedEdits || [];
        project.acceptedEdits.forEach((edit, editIndex) => {
          editButtons += `<button onclick="actions.viewArchivedEdit(${index}, ${editIndex})">View Edit by ${edit.editor}</button>`;
        });
        archivedList.innerHTML += `
          <li>
            <strong>${project.title}</strong> - ${project.summary} (Avg Popularity: ${avgRating}, Type: ${project.editType}, Status: Done)<br>
            Final Text: ${project.text.substring(0, 100)}... ${editButtons}
          </li>`;
      });
  },

  displayMyEditingWork() {
    console.log("Displaying my editing work");
    const editingList = document.getElementById("myEditingWork");
    editingList.innerHTML = "";
    state.editedProjects.forEach((edit, index) => {
      if (edit.status === "pending") {
        const isExpired = state.users[state.currentUser]?.expiredProjects?.includes(edit.title);
        editingList.innerHTML += `
          <li class="${isExpired ? 'expired' : ''}">
            <strong>${edit.title}</strong> - ${edit.summary} (${edit.editType})<br>
            Original: ${edit.text.substring(0, 50)}... 
            ${isExpired ? "<span>Expired</span>" : `<button onclick="actions.goToEdit(${edit.index})">Edit</button>`}
          </li>`;
      } else {
        editingList.innerHTML += `
          <li>
            <strong>${edit.title}</strong> - ${edit.summary} (${edit.editType})<br>
            Original: ${edit.text.substring(0, 50)}...<br>
            Your Edit: ${edit.editedSample.substring(0, 50)}...
          </li>`;
      }
    });
  },

  displayInbox() {
    console.log("Displaying inbox");
    const inbox = document.getElementById("inbox");
    inbox.innerHTML = "";
    (state.users[state.currentUser]?.inbox || []).forEach((msg, msgIndex) => {
      inbox.innerHTML += `
        <li>
          ${msg.date}: ${msg.message} 
          ${msg.editIndex !== null ? `<button onclick="actions.viewInboxEdit(${msgIndex})">View</button>` : ""}
        </li>`;
    });
  }
};

// Action handlers
const actions = {
  claimProject(index) {
    console.log("Claiming project:", index);
    if (state.userPoints < 5) {
      alert("Not enough points! Claiming costs 5 points.");
      return;
    }
    const project = state.sharedProjects[index];
    if (project.takenBy.includes(state.currentUser)) {
      alert("You’ve already claimed this project!");
      return;
    }
    if (project.maxTakers <= project.takenBy.length) {
      alert("No takers left for this project!");
      return;
    }
    if (state.users[state.currentUser]?.expiredProjects?.includes(project.title)) {
      alert("You cannot reclaim an expired project!");
      return;
    }
    state.userPoints -= 5;
    project.takenBy.push(state.currentUser);
    if (project.takenBy.length === project.maxTakers) {
      utils.sendMessage(project.owner, `All ${project.maxTakers} takers have claimed your project "${project.title}".`);
    }
    state.editedProjects.push({ 
      title: project.title, 
      summary: project.summary, 
      text: project.text, 
      editType: project.editType, 
      editor: state.currentUser, 
      index, 
      status: "pending" 
    });
    ui.updatePointsDisplay();
    ui.displayProjects();
    ui.displaySubmittedProjects();
    ui.displayMyEditingWork();
    utils.saveUserData();
    alert("Project claimed! Go to 'My Edits' to edit it.");
  },

  goToEdit(index) {
    console.log("Going to edit project:", index);
    const edit = state.editedProjects.find(e => e.index === index && e.status === "pending");
    if (edit && !state.users[state.currentUser]?.expiredProjects?.includes(edit.title)) {
      sessionStorage.setItem("currentEdit", JSON.stringify(edit));
      window.location.href = "edit.html";
    }
  },

  viewEdit(projectIndex, editIndex) {
    console.log("Viewing edit:", projectIndex, editIndex);
    const edit = state.sharedProjects[projectIndex].edits[editIndex];
    console.log("Setting currentReview:", edit);
    sessionStorage.setItem("currentReview", JSON.stringify(edit));
    sessionStorage.setItem("reviewSource", "submitted");
    window.location.href = "review.html";
  },

  viewInboxEdit(msgIndex) {
    console.log("Viewing inbox edit:", msgIndex);
    const msg = state.users[state.currentUser].inbox[msgIndex];
    if (msg.editIndex !== null) {
      const project = state.sharedProjects.find(p => p.owner === state.currentUser && p.title === msg.message.split('"')[1]);
      if (project) {
        const edit = project.status === "done" ? project.acceptedEdits[msg.editIndex] : project.edits[msg.editIndex];
        console.log("Setting currentReview from inbox:", edit);
        sessionStorage.setItem("currentReview", JSON.stringify(edit));
        sessionStorage.setItem("reviewSource", "inbox");
        window.location.href = "review.html";
      }
    }
  },

  viewArchivedEdit(projectIndex, editIndex) {
    console.log("Viewing archived edit:", projectIndex, editIndex);
    const project = state.sharedProjects[projectIndex];
    const edit = project.acceptedEdits[editIndex];
    console.log("Setting currentReview for archived:", edit);
    sessionStorage.setItem("currentReview", JSON.stringify(edit));
    sessionStorage.setItem("reviewSource", "archived");
    window.location.href = "review.html";
  },

  logout() {
    console.log("Logging out");
    if (state.editTimer) clearInterval(state.editTimer);
    state.currentUser = null;
    state.editedProjects = [];
    state.userPoints = 100;
    localStorage.removeItem("currentUser");
    sessionStorage.clear();
    document.getElementById("appSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
  },

  showTab(tabId) {
    console.log("Showing tab:", tabId);
    const tabContents = document.querySelectorAll(".tabContent");
    tabContents.forEach(tab => {
      if (tab) tab.style.display = "none"; // Null check
    });

    const activeTab = document.getElementById(tabId);
    if (activeTab) {
      activeTab.style.display = "block";
      console.log("Tab displayed:", tabId);
      if (tabId === "myEditingWork") ui.displayMyEditingWork(); // Ensure My Edits renders
      if (tabId === "myProjects") {
        ui.displaySubmittedProjects();
        ui.displayCompletedEdits();
        ui.displayInbox();
      }
      if (tabId === "homepage") ui.displayProjects();
      if (tabId === "archived") ui.displayArchivedProjects();
    } else {
      console.warn("Tab not found:", tabId);
      const homeTab = document.getElementById("homepage");
      if (homeTab) homeTab.style.display = "block"; // Fallback to homepage
    }

    document.querySelectorAll(".tabButton").forEach(btn => {
      btn.classList.remove("active");
      if (btn.getAttribute("onclick") === `actions.showTab('${tabId}')`) btn.classList.add("active");
    });
  }
};

// Initialization
function initializeApp() {
  console.log("initializeApp started");

  const storedUser = localStorage.getItem("currentUser");
  if (storedUser && state.users[storedUser]) {
    console.log("Restoring session for:", storedUser);
    state.currentUser = storedUser;
    utils.loadUserData();
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("appSection").style.display = "block";
    ui.updatePointsDisplay();
    ui.displayProjects();
    ui.displaySubmittedProjects();
    ui.displayCompletedEdits();
    ui.displayArchivedProjects();
    ui.displayMyEditingWork();
    ui.displayInbox();
    const hash = window.location.hash.slice(1) || "homepage";
    actions.showTab(hash);
  } else {
    console.log("No session found, showing login");
  }

  let isLoginMode = true;
  window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    document.getElementById("authTitle").textContent = isLoginMode ? "Login" : "Signup";
    document.getElementById("authButton").textContent = isLoginMode ? "Login" : "Signup";
    document.getElementById("toggleAuth").textContent = isLoginMode ? "Switch to Signup" : "Switch to Login";
  };

  document.getElementById("authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    console.log("Auth form submitted");
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      alert("Please enter both username and password!");
      return;
    }

    if (isLoginMode) {
      if (state.users[username]?.password === password) {
        state.currentUser = username;
        localStorage.setItem("currentUser", state.currentUser);
        utils.loadUserData();
        document.getElementById("loginSection").style.display = "none";
        document.getElementById("appSection").style.display = "block";
        ui.updatePointsDisplay();
        ui.displayProjects();
        ui.displaySubmittedProjects();
        ui.displayCompletedEdits();
        ui.displayArchivedProjects();
        ui.displayMyEditingWork();
        ui.displayInbox();
        const hash = window.location.hash.slice(1) || "homepage";
        actions.showTab(hash);
      } else {
        alert("Invalid username or password!");
      }
    } else {
      if (state.users[username]) {
        alert("Username already exists!");
      } else {
        state.users[username] = { password, points: 100, editedProjects: [], inbox: [], expiredProjects: [] };
        localStorage.setItem("users", JSON.stringify(state.users));
        alert("Account created! Please log in.");
        window.toggleAuthMode();
      }
    }
  });

  document.getElementById("projectForm").addEventListener("submit", (event) => {
    event.preventDefault();
    console.log("Project form submitted");
    const title = document.getElementById("title").value;
    const summary = document.getElementById("summary").value;
    const text = document.getElementById("text").value;
    const editType = document.getElementById("editType").value;
    const maxTakers = parseInt(document.getElementById("takers").value);

    if (!title || !summary || !text || maxTakers < 1 || maxTakers > 10) {
      alert("Please fill out all fields correctly! Takers must be 1-10.");
      return;
    }
    if (state.userPoints < 10) {
      alert("Not enough points! Submission costs 10 points.");
      return;
    }
    state.userPoints -= 10;
    state.sharedProjects.push({ 
      title, 
      summary, 
      text, 
      editType, 
      ratingTotal: 0, 
      ratingCount: 0, 
      owner: state.currentUser, 
      maxTakers, 
      takenBy: [], 
      status: "open", 
      edits: [],
      acceptedEdits: []
    });
    document.getElementById("title").value = "";
    document.getElementById("summary").value = "";
    document.getElementById("text").value = "";
    document.getElementById("takers").value = "1";
    alert("Project submitted successfully!");
    utils.sendMessage(state.currentUser, `Project "${title}" submitted.`);
    ui.updatePointsDisplay();
    ui.displayProjects();
    ui.displaySubmittedProjects();
    ui.displayCompletedEdits();
    ui.displayArchivedProjects();
  });

  console.log("initializeApp completed");
}

document.addEventListener("DOMContentLoaded", initializeApp);

// Expose actions globally
Object.keys(actions).forEach(key => window[key] = actions[key]);