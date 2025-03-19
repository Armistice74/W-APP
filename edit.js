document.addEventListener("DOMContentLoaded", () => {
  const currentEditRaw = sessionStorage.getItem("currentEdit");
  console.log("Raw sessionStorage currentEdit:", currentEditRaw);

  if (!currentEditRaw) {
    console.error("No edit data found in sessionStorage");
    window.location.href = "index.html";
    return;
  }

  let currentEdit;
  try {
    currentEdit = JSON.parse(currentEditRaw);
    console.log("Parsed currentEdit:", currentEdit);
  } catch (e) {
    console.error("Failed to parse currentEdit:", e);
    window.location.href = "index.html";
    return;
  }

  const initialContent = (currentEdit.text && typeof currentEdit.text === 'string' && currentEdit.text.trim() !== '')
    ? currentEdit.text
    : "<p>Start editing...</p>";
  console.log("Initial content set to:", initialContent);

  // Set project title and owner
  document.getElementById("project-title").textContent = `${currentEdit.title} by ${currentEdit.user}`;

  const { Editor, Mark, Node } = window.TiptapBundle;

  const Comment = Mark.create({
    name: 'comment',
    addAttributes() {
      return { id: { default: null } };
    },
    parseHTML() {
      return [{ tag: 'span[data-comment-id]', getAttrs: dom => ({ id: dom.getAttribute('data-comment-id') }) }];
    },
    renderHTML({ mark }) {
      return ['span', { 'data-comment-id': mark.attrs.id, class: 'comment' + (comments.find(c => c.id === mark.attrs.id && !c.isTyping) ? ' posted' : '') }, 0];
    }
  });

  const Document = Node.create({
    name: 'doc',
    topNode: true,
    content: 'text*'
  });

  const Text = Node.create({
    name: 'text'
  });

  const editor = new Editor({
    element: document.getElementById("editor"),
    extensions: [Document, Text, Comment],
    content: initialContent,
    onCreate: ({ editor }) => {
      console.log("TipTap editor initialized");
      console.log("Editor content after init:", editor.getHTML());
      renderComments();
    },
    onUpdate: ({ editor }) => {
      currentEdit.text = editor.getHTML();
      sessionStorage.setItem("currentEdit", JSON.stringify(currentEdit));
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) showToolBubble(from, to);
      else hideToolBubble();
    }
  });

  let comments = currentEdit.comments || [];

  document.getElementById("editor").addEventListener('click', (e) => {
    const span = e.target.closest('span[data-comment-id]');
    if (span) {
      const commentId = span.dataset.commentId;
      console.log("Clicked highlight:", commentId);
      highlightCommentBubble(commentId);
    }
  });

  // Submit Edits button
  document.getElementById("submit-edits").addEventListener('click', () => {
    document.getElementById("submit-confirm").style.display = 'block';
  });

  document.getElementById("confirm-submit").addEventListener('click', () => {
    console.log("Submitting edits:", currentEdit);
    const projects = JSON.parse(localStorage.getItem("projects") || "[]");
    const projectIndex = projects.findIndex(p => p.id === currentEdit.id);
    if (projectIndex !== -1) {
      projects[projectIndex].editedSample = editor.getHTML();
      projects[projectIndex].comments = comments.filter(c => !c.isTyping); // Only save posted comments
      localStorage.setItem("projects", JSON.stringify(projects));
    }
    sessionStorage.removeItem("currentEdit");
    window.location.href = "index.html#my-edits";
  });

  function showToolBubble(from, to) {
    let bubble = document.getElementById('tool-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'tool-bubble';
      bubble.innerHTML = '<button id="tool-comment-btn">Comment</button>';
      document.body.appendChild(bubble);
    }
    const rect = editor.view.coordsAtPos(from);
    bubble.style.left = `${rect.left + window.scrollX}px`;
    bubble.style.top = `${rect.top + window.scrollY - 40}px`;
    bubble.style.display = 'block';

    const commentBtn = document.getElementById('tool-comment-btn');
    commentBtn.onclick = () => addComment(from, to);
  }

  function hideToolBubble() {
    const bubble = document.getElementById('tool-bubble');
    if (bubble) bubble.style.display = 'none';
  }

  function addComment(from, to) {
    if (comments.some(c => c.isTyping)) {
      console.log("Blocked: Already typing a comment");
      return;
    }
    const commentId = Date.now().toString();
    console.log("Adding comment:", { id: commentId, from, to });
    editor.chain().setMark('comment', { id: commentId }).run();
    comments.push({ id: commentId, text: '', range: { from, to }, user: localStorage.getItem("currentUser"), timestamp: null, isTyping: true });
    currentEdit.comments = comments;
    sessionStorage.setItem("currentEdit", JSON.stringify(currentEdit));
    renderComments();
  }

  function adjustBubbleSize(bubble, textarea) {
    bubble.style.height = 'auto';
    bubble.style.height = `${textarea.scrollHeight + 40}px`;
  }

  function postComment(id) {
    const comment = comments.find(c => c.id === id);
    if (comment && comment.isTyping) {
      comment.isTyping = false;
      comment.timestamp = new Date().toLocaleString();
      currentEdit.comments = comments;
      sessionStorage.setItem("currentEdit", JSON.stringify(currentEdit));
      console.log("Posted comment, stack order:", comments.map(c => ({ id: c.id, from: c.range.from })));
      renderComments();
      editor.view.dispatch(editor.state.tr);
    }
  }

  function highlightCommentBubble(commentId) {
    document.querySelectorAll('.speech-bubble.highlighted').forEach(bubble => {
      bubble.classList.remove('highlighted');
    });
    const bubble = document.querySelector(`.speech-bubble[data-comment-id="${commentId}"]`);
    if (bubble) {
      bubble.classList.add('highlighted');
      console.log("Highlighted bubble:", commentId);
    }
  }

  function renderComments() {
    const commentWindow = document.getElementById('comments');
    commentWindow.innerHTML = '';

    comments.sort((a, b) => a.range.from - b.range.from);
    console.log("Rendering stack:", comments.map(c => ({ id: c.id, from: c.range.from, text: c.text.slice(0, 10) + '...', isTyping: c.isTyping })));

    comments.forEach(comment => {
      const existing = commentWindow.querySelector(`[data-comment-id="${comment.id}"]`);
      if (existing) return;

      const bubble = document.createElement('div');
      bubble.className = 'speech-bubble' + (comment.isTyping ? '' : ' posted');
      bubble.dataset.commentId = comment.id;

      if (comment.isTyping) {
        bubble.innerHTML = `
          <textarea placeholder="Enter comment...">${comment.text}</textarea>
          <button class="confirm-btn">Confirm</button>
        `;
        const textarea = bubble.querySelector('textarea');
        const confirmBtn = bubble.querySelector('.confirm-btn');
        textarea.oninput = () => {
          comment.text = textarea.value;
          adjustBubbleSize(bubble, textarea);
        };
        confirmBtn.onclick = () => {
          console.log("Confirm clicked for:", comment.id);
          postComment(comment.id);
        };
        setTimeout(() => textarea.focus(), 0);
      } else {
        const maxLines = 3;
        const lineHeight = 20;
        const truncated = comment.text.split('\n').slice(0, maxLines).join('\n') + (comment.text.split('\n').length > maxLines ? '...' : '');
        bubble.innerHTML = `
          <p>${truncated}</p>
          ${comment.text.split('\n').length > maxLines ? '<span class="show-more">show more</span>' : ''}
        `;
        bubble.style.height = `${Math.min(comment.text.split('\n').length, maxLines) * lineHeight + 20}px`;
        const showMore = bubble.querySelector('.show-more');
        if (showMore) {
          showMore.onclick = () => {
            bubble.innerHTML = `<p>${comment.text}</p>`;
            bubble.style.height = `${comment.text.split('\n').length * lineHeight + 20}px`;
          };
        }
      }
      commentWindow.appendChild(bubble);
    });
  }
});