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

  document.getElementById("project-title").textContent = currentEdit.title;
  document.getElementById("project-owner").textContent = `By ${currentEdit.user}`;

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

  const Suggestion = Mark.create({
    name: 'suggestion',
    addAttributes() {
      return { id: { default: null }, text: { default: '' }, original: { default: '' } };
    },
    parseHTML() {
      return [{ tag: 'span[data-suggestion-id]', getAttrs: dom => ({ 
        id: dom.getAttribute('data-suggestion-id'), 
        text: dom.getAttribute('data-suggestion-text'), 
        original: dom.getAttribute('data-suggestion-original') 
      }) }];
    },
    renderHTML({ mark }) {
      const comment = comments.find(c => c.id === mark.attrs.id && c.isSuggestion);
      if (comment && comment.text !== comment.originalText) {
        const deleted = comment.originalText.split('').filter(c => !comment.text.includes(c)).join('');
        const added = comment.text.split('').filter(c => !comment.originalText.includes(c)).join('');
        return ['span', { 
          'data-suggestion-id': mark.attrs.id, 
          'data-suggestion-text': mark.attrs.text, 
          'data-suggestion-original': mark.attrs.original, 
          class: 'suggestion posted' 
        }, deleted ? `<s>${deleted}</s>` : '', `<span class="suggestion-text">${added || comment.text}</span>`];
      }
      return ['span', { 'data-suggestion-id': mark.attrs.id, class: 'suggestion' }, mark.attrs.original || ''];
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
    extensions: [Document, Text, Comment, Suggestion],
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
      if (from !== to && !isSuggestionMode()) showToolBubble(from, to);
      else hideToolBubble();
    }
  });

  let comments = currentEdit.comments || [];
  let suggestionMode = false;

  document.getElementById("editor").addEventListener('click', (e) => {
    const span = e.target.closest('span[data-comment-id], span[data-suggestion-id]');
    if (span) {
      const commentId = span.dataset.commentId || span.dataset.suggestionId;
      console.log("Clicked highlight:", commentId);
      highlightCommentBubble(commentId);
    }
  });

  document.getElementById("suggestion-mode").addEventListener('change', (e) => {
    suggestionMode = e.target.checked;
    console.log("Suggestion mode:", suggestionMode ? "ON" : "OFF");
    if (!suggestionMode) {
      finalizeSuggestions();
    }
  });

  document.getElementById("submit-edits").addEventListener('click', () => {
    document.getElementById("submit-confirm").style.display = 'block';
  });

  document.getElementById("confirm-submit").addEventListener('click', () => {
    console.log("Submitting edits:", currentEdit);
    const projects = JSON.parse(localStorage.getItem("projects") || "[]");
    const projectIndex = projects.findIndex(p => p.id === currentEdit.id);
    if (projectIndex !== -1) {
      projects[projectIndex].editedSample = editor.getHTML();
      projects[projectIndex].comments = comments.filter(c => !c.isTyping);
      localStorage.setItem("projects", JSON.stringify(projects));
    }
    sessionStorage.removeItem("currentEdit");
    window.location.href = "index.html#myEditingWork";
  });

  function showToolBubble(from, to) {
    let bubble = document.getElementById('tool-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'tool-bubble';
      bubble.innerHTML = `<button id="tool-comment-btn">Comment</button>`;
      document.body.appendChild(bubble);
    }
    const rect = editor.view.coordsAtPos(from);
    bubble.style.left = `${rect.left + window.scrollX}px`;
    bubble.style.top = `${rect.top + window.scrollY - 40}px`;
    bubble.style.display = 'block';

    const commentBtn = document.getElementById("tool-comment-btn");
    commentBtn.onclick = () => {
      addComment(from, to);
      hideToolBubble();
    };
  }

  function hideToolBubble() {
    const bubble = document.getElementById('tool-bubble');
    if (bubble) bubble.style.display = 'none';
  }

  function isSuggestionMode() {
    return suggestionMode;
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

  function addSuggestion(from, to) {
    const commentId = Date.now().toString();
    const originalText = editor.state.doc.textBetween(from, to);
    console.log("Adding suggestion:", { id: commentId, from, to, originalText });
    editor.chain().setMark('suggestion', { id: commentId, text: originalText, original: originalText }).run();
    comments.push({ id: commentId, text: originalText, originalText, range: { from, to }, user: localStorage.getItem("currentUser"), timestamp: null, isTyping: true, isSuggestion: true });
    currentEdit.comments = comments;
    sessionStorage.setItem("currentEdit", JSON.stringify(currentEdit));
    const span = editor.view.dom.querySelector(`[data-suggestion-id="${commentId}"]`);
    span.contentEditable = true;
    span.focus();
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

  function finalizeSuggestions() {
    comments.forEach(comment => {
      if (comment.isSuggestion && comment.isTyping) {
        const span = editor.view.dom.querySelector(`[data-suggestion-id="${comment.id}"]`);
        if (span) {
          comment.text = span.textContent;
          comment.isTyping = false;
          comment.timestamp = new Date().toLocaleString();
          editor.chain().setMark('suggestion', { id: comment.id, text: comment.text, original: comment.originalText }).run();
          console.log("Finalized suggestion:", { id: comment.id, text: comment.text, original: comment.originalText });
          span.contentEditable = false;
        }
      }
    });
    currentEdit.comments = comments;
    sessionStorage.setItem("currentEdit", JSON.stringify(currentEdit));
    editor.view.dispatch(editor.state.tr);
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
      if (comment.isSuggestion) return;
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
          console.log("Confirm clicked for comment:", comment.id);
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

  function adjustBubbleSize(bubble, textarea) {
    bubble.style.height = 'auto';
    bubble.style.height = `${textarea.scrollHeight + 40}px`;
  }

  editor.view.dom.addEventListener('input', (e) => {
    if (isSuggestionMode()) {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const start = editor.state.doc.resolve(range.startOffset).pos;
      const end = editor.state.doc.resolve(range.endOffset).pos;
      const node = range.startContainer.parentElement;
      if (node && node.dataset.suggestionId) {
        const commentId = node.dataset.suggestionId;
        const comment = comments.find(c => c.id === commentId && c.isSuggestion);
        if (comment) {
          comment.text = node.textContent;
          console.log("Suggestion updated live:", { id: commentId, text: comment.text });
        }
      } else if (range.startContainer.nodeType === 3) {
        addSuggestion(start, end);
      }
    }
  });
});