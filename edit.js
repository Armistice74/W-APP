function initEditor() {
  if (!window.TiptapBundle) {
    console.log("Waiting for TipTapBundle...");
    setTimeout(initEditor, 100);
    return;
  }
  console.log("DOM loaded, initializing TipTap 2.11.5");
  console.log("window.TiptapBundle:", window.TiptapBundle);

  const currentEditRaw = sessionStorage.getItem("currentEdit");
  if (!currentEditRaw) {
    console.error("No edit data found in sessionStorage");
    alert("No edit data found!");
    window.location.href = "index.html";
    return;
  }

  let currentEdit;
  try {
    currentEdit = JSON.parse(currentEditRaw);
    console.log("Loaded currentEdit:", currentEdit);
  } catch (e) {
    console.error("Failed to parse currentEdit:", e);
    alert("Invalid edit data!");
    window.location.href = "index.html";
    return;
  }

  const titleElement = document.getElementById("editTitle");
  const typeElement = document.getElementById("editTypeDisplay");
  const editorElement = document.getElementById("editor");
  if (!titleElement || !typeElement || !editorElement) {
    console.error("Missing required DOM elements");
    alert("Page setup error!");
    return;
  }
  titleElement.textContent = currentEdit.title;
  typeElement.textContent = currentEdit.editType;

  const { Editor } = window.TiptapBundle;
  const StarterKit = window.TiptapBundle.StarterKit;

  const editor = new Editor({
    element: editorElement,
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true }
      })
    ],
    content: currentEdit.text || "<p>Start editing...</p>",
    onUpdate: ({ editor }) => {
      updateWordCount(editor);
      currentEdit.text = editor.getHTML();
      sessionStorage.setItem("currentEdit", JSON.stringify(currentEdit));
    },
    onCreate: () => console.log("TipTap editor 2.11.5 initialized")
  });

  let comments = currentEdit.comments || [];
  renderComments();

  let timeLeft = 300;
  let editTimer = null;
  startEditTimer();

  document.getElementById("boldBtn").addEventListener("click", () => editor.chain().focus().toggleBold().run());
  document.getElementById("italicBtn").addEventListener("click", () => editor.chain().focus().toggleItalic().run());
  document.getElementById("underlineBtn").addEventListener("click", () => editor.chain().focus().toggleUnderline().run());
  document.getElementById("strikeBtn").addEventListener("click", () => editor.chain().focus().toggleStrike().run());
  document.getElementById("fontSizeSelect").addEventListener("change", (e) => editor.chain().focus().setFontSize(e.target.value).run());
  document.getElementById("bulletListBtn").addEventListener("click", () => editor.chain().focus().toggleBulletList().run());
  document.getElementById("orderedListBtn").addEventListener("click", () => editor.chain().focus().toggleOrderedList().run());
  document.getElementById("undoBtn").addEventListener("click", () => editor.chain().focus().undo().run());
  document.getElementById("redoBtn").addEventListener("click", () => editor.chain().focus().redo().run());
  document.getElementById("commentBtn").addEventListener("click", addComment);
  document.getElementById("submitEdit").addEventListener("click", submitEdit);
  document.getElementById("cancelEdit").addEventListener("click", cancelEdit);

  function submitEdit() {
    console.log("Submitting edit for:", currentEdit.title);
    clearInterval(editTimer);
    const editedSample = editor.getHTML();
    const popularityScore = parseInt(prompt(`Assign a popularity score for "${currentEdit.title}" (0-10):`), 10);
    let rating = isNaN(popularityScore) || popularityScore < 0 || popularityScore > 10 ? 0 : popularityScore;

    const users = JSON.parse(localStorage.getItem("users")) || {};
    const sharedProjects = JSON.parse(localStorage.getItem("sharedProjects")) || [];
    const currentUser = localStorage.getItem("currentUser");

    if (!currentUser || !sharedProjects[currentEdit.index]) {
      console.error("Missing user or project data");
      alert("Submission failed!");
      return;
    }

    const edit = {
      title: currentEdit.title,
      summary: currentEdit.summary,
      text: currentEdit.text,
      editType: currentEdit.editType,
      editedSample,
      editor: currentUser,
      ratingTotal: rating,
      ratingCount: 1,
      comments
    };

    users[currentUser].editedProjects = users[currentUser].editedProjects || [];
    users[currentUser].editedProjects = users[currentUser].editedProjects.map(e =>
      e.index === currentEdit.index && e.status === "pending" ? edit : e
    );
    sharedProjects[currentEdit.index].edits.push(edit);
    sharedProjects[currentEdit.index].ratingTotal += rating;
    sharedProjects[currentEdit.index].ratingCount = (sharedProjects[currentEdit.index].ratingCount || 0) + 1;

    if (sharedProjects[currentEdit.index].takenBy.length === sharedProjects[currentEdit.index].maxTakers) {
      sharedProjects[currentEdit.index].status = "done";
      sendMessage(users, sharedProjects[currentEdit.index].owner, `All edits for "${currentEdit.title}" are complete. Project marked as done.`);
    }
    sendMessage(users, sharedProjects[currentEdit.index].owner, `Editor ${currentUser} completed an edit for "${currentEdit.title}".`, sharedProjects[currentEdit.index].edits.length - 1);

    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("sharedProjects", JSON.stringify(sharedProjects));
    sessionStorage.removeItem("currentEdit");
    alert(`Editing "${currentEdit.title}" complete! Popularity Score: ${rating}`);
    console.log("Redirecting to my projects");
    window.location.href = "index.html#myProjects";
  }

  function cancelEdit() {
    console.log("Canceling edit");
    clearInterval(editTimer);
    const users = JSON.parse(localStorage.getItem("users")) || {};
    const sharedProjects = JSON.parse(localStorage.getItem("sharedProjects")) || [];
    const currentUser = localStorage.getItem("currentUser");

    sharedProjects[currentEdit.index].takenBy = sharedProjects[currentEdit.index].takenBy.filter(u => u !== currentUser);
    users[currentUser].points += 5;
    sendMessage(users, currentUser, `You canceled editing "${currentEdit.title}". Take returned to pool.`);

    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("sharedProjects", JSON.stringify(sharedProjects));
    sessionStorage.removeItem("currentEdit");
    window.location.href = "index.html#myProjects";
  }

  function addComment() {
    const selection = editor.state.selection;
    if (selection.empty) {
      alert("Please select text to comment on!");
      return;
    }
    const commentText = prompt("Enter your comment:");
    if (commentText) {
      const commentId = Date.now().toString();
      editor.chain().focus().setMark('comment', { id: commentId }).run();
      comments.push({
        id: commentId,
        text: commentText,
        range: { from: selection.from, to: selection.to },
        user: localStorage.getItem("currentUser"),
        timestamp: new Date().toLocaleString()
      });
      currentEdit.comments = comments;
      sessionStorage.setItem("currentEdit", JSON.stringify(currentEdit));
      renderComments();
    }
  }

  function startEditTimer() {
    document.getElementById("editTimer").textContent = formatTime(timeLeft);
    editTimer = setInterval(() => {
      timeLeft--;
      document.getElementById("editTimer").textContent = formatTime(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(editTimer);
        expireEdit();
      }
    }, 1000);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function expireEdit() {
    console.log("Edit time expired");
    const users = JSON.parse(localStorage.getItem("users")) || {};
    const sharedProjects = JSON.parse(localStorage.getItem("sharedProjects")) || [];
    const currentUser = localStorage.getItem("currentUser");

    sharedProjects[currentEdit.index].takenBy = sharedProjects[currentEdit.index].takenBy.filter(u => u !== currentUser);
    users[currentUser].points += 5;
    users[currentUser].expiredProjects = users[currentUser].expiredProjects || [];
    users[currentUser].expiredProjects.push(currentEdit.title);
    sendMessage(users, currentUser, `Your edit time for "${currentEdit.title}" expired. Take returned to pool.`);
    sendMessage(users, sharedProjects[currentEdit.index].owner, `Editor ${currentUser} failed to edit "${currentEdit.title}" in time. Takers left: ${sharedProjects[currentEdit.index].maxTakers - sharedProjects[currentEdit.index].takenBy.length}`);

    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("sharedProjects", JSON.stringify(sharedProjects));
    sessionStorage.removeItem("currentEdit");

    editor.setEditable(false);
    document.getElementById("submitEdit").style.display = "none";
    document.getElementById("cancelEdit").style.display = "none";
    const expiryMessage = document.createElement("div");
    expiryMessage.id = "expiryMessage";
    expiryMessage.innerHTML = `
      <p>Edit time has expired!</p>
      <button onclick="window.location.href='index.html#myProjects'">Return to My Projects</button>
    `;
    document.body.appendChild(expiryMessage);
  }

  function sendMessage(users, username, message, editIndex = null) {
    users[username].inbox = users[username].inbox || [];
    users[username].inbox.push({ date: new Date().toLocaleString(), message, editIndex });
  }

  function updateWordCount(editor) {
    const text = editor.getText();
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const chars = text.length;
    document.getElementById("wordCount").textContent = `Words: ${words} | Characters: ${chars}`;
  }

  function renderComments() {
    const sidebar = document.getElementById("comments-sidebar");
    sidebar.innerHTML = "<h3>Comments</h3>";
    comments.forEach(comment => {
      const commentDiv = document.createElement("div");
      commentDiv.className = "comment-item";
      commentDiv.innerHTML = `
        <p><strong>${comment.user}</strong> (${comment.timestamp})</p>
        <p>${comment.text}</p>
        <small>Range: ${comment.range.from}-${comment.range.to}</small>
      `;
      sidebar.appendChild(commentDiv);
    });
  }
}

document.addEventListener("DOMContentLoaded", initEditor);