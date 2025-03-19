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
      return ['span', { 'data-comment-id': mark.attrs.id, class: 'comment' }, 0];
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
    commentBtn.onclick = null;
    commentBtn.addEventListener('click', () => addComment(from, to));
  }

  function hideToolBubble() {
    const bubble = document.getElementById('tool-bubble');
    if (bubble) bubble.style.display = 'none';
  }

  function addComment(from, to) {
    const commentId = Date.now().toString();
    editor.chain().setMark('comment', { id: commentId }).run();
    const commentWindow = document.getElementById('comments');
    const speechBubble = document.createElement('div');
    speechBubble.className = 'speech-bubble';
    speechBubble.innerHTML = `
      <textarea placeholder="Enter comment..."></textarea>
      <button class="confirm-btn">Confirm</button>
    `;
    commentWindow.appendChild(speechBubble);

    const rect = editor.view.coordsAtPos(from);
    speechBubble.style.top = `${rect.top - commentWindow.offsetTop}px`;

    const textarea = speechBubble.querySelector('textarea');
    textarea.addEventListener('input', () => adjustBubbleSize(speechBubble, textarea));
    speechBubble.querySelector('.confirm-btn').addEventListener('click', () => postComment(commentId, from, to, textarea.value, speechBubble));
  }

  function adjustBubbleSize(bubble, textarea) {
    bubble.style.height = 'auto';
    const nextBubble = bubble.nextElementSibling;
    const maxHeight = nextBubble ? nextBubble.offsetTop - bubble.offsetTop - 10 : Infinity;
    bubble.style.height = `${Math.min(textarea.scrollHeight + 40, maxHeight)}px`;
  }

  function postComment(id, from, to, text, bubble) {
    comments.push({ id, text, range: { from, to }, user: localStorage.getItem("currentUser"), timestamp: new Date().toLocaleString() });
    currentEdit.comments = comments;
    sessionStorage.setItem("currentEdit", JSON.stringify(currentEdit));

    const maxLines = 3;
    const lineHeight = 20;
    const truncated = text.split('\n').slice(0, maxLines).join('\n') + (text.split('\n').length > maxLines ? '...' : '');
    bubble.innerHTML = `
      <p>${truncated}</p>
      ${text.split('\n').length > maxLines ? '<span class="show-more">show more</span>' : ''}
    `;
    bubble.style.height = `${Math.min(text.split('\n').length, maxLines) * lineHeight + 20}px`;
    bubble.classList.add('posted');
    document.getElementById('comments').scrollTop = bubble.offsetTop;

    const showMore = bubble.querySelector('.show-more');
    if (showMore) {
      showMore.addEventListener('click', () => {
        bubble.innerHTML = `<p>${text}</p>`;
        bubble.style.height = `${text.split('\n').length * lineHeight + 20}px`;
      });
    }
  }

  function renderComments() {
    const commentWindow = document.getElementById('comments');
    commentWindow.innerHTML = '';
    comments.forEach(comment => {
      const bubble = document.createElement('div');
      bubble.className = 'speech-bubble posted';
      const maxLines = 3;
      const lineHeight = 20;
      const truncated = comment.text.split('\n').slice(0, maxLines).join('\n') + (comment.text.split('\n').length > maxLines ? '...' : '');
      bubble.innerHTML = `<p>${truncated}</p>${comment.text.split('\n').length > maxLines ? '<span class="show-more">show more</span>' : ''}`;
      bubble.style.top = `${editor.view.coordsAtPos(comment.range.from).top - commentWindow.offsetTop}px`;
      commentWindow.appendChild(bubble);
      const showMore = bubble.querySelector('.show-more');
      if (showMore) {
        showMore.addEventListener('click', () => {
          bubble.innerHTML = `<p>${comment.text}</p>`;
          bubble.style.height = `${comment.text.split('\n').length * lineHeight + 20}px`;
        });
      }
    });
  }

  editor.on('create', () => renderComments());
});