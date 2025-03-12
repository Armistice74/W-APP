document.addEventListener("DOMContentLoaded", function() {
  const currentReviewRaw = sessionStorage.getItem("currentReview");
  const currentReview = currentReviewRaw ? JSON.parse(currentReviewRaw) : null;
  const reviewSource = sessionStorage.getItem("reviewSource");

  if (!currentReview) {
    console.log("No currentReview data in sessionStorage");
    alert("No review data found!");
    window.location.href = "index.html";
    return;
  }

  console.log("Loaded currentReview:", currentReview);

  document.getElementById("reviewTitle").textContent = currentReview.title;
  document.getElementById("reviewType").textContent = currentReview.editType;
  document.getElementById("reviewEditor").textContent = currentReview.editor;
  document.getElementById("originalText").innerHTML = currentReview.text;
  document.getElementById("editedText").innerHTML = currentReview.editedSample;

  const currentUser = localStorage.getItem("currentUser");
  const users = JSON.parse(localStorage.getItem("users")) || {};
  const sharedProjects = JSON.parse(localStorage.getItem("sharedProjects")) || [];
  const project = sharedProjects.find(p => p.title === currentReview.title);

  // Show review actions only if project is not done and edit is pending review
  if ((reviewSource === "submitted" || reviewSource === "inbox") && 
      currentUser === project.owner && 
      project.status !== "done" && 
      project.edits.some(e => e.editor === currentReview.editor && e.editedSample === currentReview.editedSample)) {
    document.getElementById("reviewActions").style.display = "block";
  }

  window.goBack = function() {
    sessionStorage.removeItem("currentReview");
    sessionStorage.removeItem("reviewSource");
    window.location.href = "index.html#user";
  };

  window.acceptEdit = function() {
    const editIndex = project.edits.findIndex(e => e.editor === currentReview.editor && e.editedSample === currentReview.editedSample);
    project.text = currentReview.editedSample;
    project.ratingTotal = (project.ratingTotal || 0) + 10; // One-time rating
    project.ratingCount = (project.ratingCount || 0) + 1;
    users[currentReview.editor].points = (users[currentReview.editor].points || 0) + 10;
    users[currentReview.editor].editedProjects = users[currentReview.editor].editedProjects.map(e => 
      e.title === currentReview.title && e.editor === currentReview.editor && e.status !== "pending" ? { ...e, status: "accepted" } : e
    );
    const acceptedEdit = project.edits.splice(editIndex, 1)[0];
    project.acceptedEdits = project.acceptedEdits || [];
    project.acceptedEdits.push(acceptedEdit);
    if (project.takenBy.length === project.maxTakers && project.edits.length === 0) {
      project.status = "done";
    }
    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("sharedProjects", JSON.stringify(sharedProjects));
    alert("Edit accepted! Editor awarded 10 points.");
    window.location.href = "index.html#user";
  };

  window.rejectEdit = function() {
    const editIndex = project.edits.findIndex(e => e.editor === currentReview.editor && e.editedSample === currentReview.editedSample);
    project.edits.splice(editIndex, 1);
    if (project.takenBy.length === project.maxTakers && project.edits.length === 0) {
      project.status = "done";
    }
    localStorage.setItem("sharedProjects", JSON.stringify(sharedProjects));
    alert("Edit rejected!");
    window.location.href = "index.html#user";
  };
});