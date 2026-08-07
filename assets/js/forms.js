/* Wires forms to FormSubmit.co's AJAX endpoint so submissions email to KCC
   without leaving the page. First submission to a new address requires a
   one-time confirmation click sent to that inbox before mail flows. */
(function () {
  "use strict";
  var ENDPOINT = "https://formsubmit.co/ajax/humanoidr6@gmail.com";

  function wireForm(formId, statusId, subject, successMessage) {
    var form = document.getElementById(formId);
    var status = document.getElementById(statusId);
    if (!form || !status) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.elements["_honey"] && form.elements["_honey"].value) return;

      var btn = form.querySelector('button[type="submit"]');
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data._subject = subject;
      data._captcha = "false";

      btn.disabled = true;
      status.className = "form-status";
      status.textContent = "Sending…";

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("bad status " + res.status);
          status.className = "form-status ok";
          status.textContent = successMessage;
          form.reset();
        })
        .catch(function () {
          status.className = "form-status err";
          status.textContent = "Something went wrong sending that — please try again or email us directly.";
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  wireForm("contactForm", "contactFormStatus", "New KCC contact form message",
    "Thank you for contacting KCC — we’ll get back to you shortly.");
  wireForm("suggestionForm", "suggestionFormStatus", "New KCC basket suggestion",
    "Suggestion submitted — thank you!");
})();
