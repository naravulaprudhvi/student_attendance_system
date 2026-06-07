// ==========================================
// Student Attendance System - Unified JS
// ==========================================

// ==========================================
// 1. Shared Database & Alerts Module
// ==========================================

async function seedDatabaseIfEmpty() {
  const classes = await getAll('classes');
  if (classes.length === 0) {
    console.log("Seeding initial demo data...");
    await save('classes', { id: 'C101', name: 'Mathematics Class' });
    await save('classes', { id: 'C102', name: 'Science Class' });

    await save('teachers', { id: 'T101', name: 'Sarah Connor', contact: '1234567890', subject: 'Mathematics', password: 'password' });
    await save('teachers', { id: 'T102', name: 'John Doe', contact: '9876543210', subject: 'Science', password: 'password' });

    await save('students', { id: 'S101', name: 'Alice Smith', classId: 'C101', contact: '1112223333', gender: 'Female' });
    await save('students', { id: 'S102', name: 'Bob Jones', classId: 'C101', contact: '4445556666', gender: 'Male' });
    await save('students', { id: 'S103', name: 'Charlie Brown', classId: 'C102', contact: '7778889999', gender: 'Male' });
    await save('students', { id: 'S104', name: 'Diana Prince', classId: 'C102', contact: '2223334444', gender: 'Female' });

    // Seed some past attendance logs to make reports look real on initial load
    const today = new Date();
    for (let i = 1; i <= 5; i++) {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - i);
      const dateStr = formatDate(pastDate);

      // C101: Alice & Bob
      await save('attendance', { classId: 'C101', studentId: 'S101', date: dateStr, status: Math.random() > 0.2 ? 'Present' : 'Absent', markedByAdmin: false });
      await save('attendance', { classId: 'C101', studentId: 'S102', date: dateStr, status: Math.random() > 0.2 ? 'Present' : 'Absent', markedByAdmin: false });

      // C102: Charlie & Diana
      await save('attendance', { classId: 'C102', studentId: 'S103', date: dateStr, status: Math.random() > 0.2 ? 'Present' : 'Absent', markedByAdmin: false });
      await save('attendance', { classId: 'C102', studentId: 'S104', date: dateStr, status: Math.random() > 0.2 ? 'Present' : 'Absent', markedByAdmin: false });
    }
    console.log("Database seeding completed.");
  }
}

function handleLogout(e) {
  if (e) e.preventDefault();
  localStorage.removeItem('teacherid');
  localStorage.removeItem('classid');
  localStorage.removeItem('studentid');
  localStorage.removeItem('isAdmin');
  window.location.href = 'login.html';
}
window.handleLogout = handleLogout;

function goToReport() {
  const teacherId = getQueryParam('teacherid') || localStorage.getItem('teacherid');
  const classId = getQueryParam('classid') || localStorage.getItem('classid');
  if (!teacherId || !classId) {
    showAlert("Missing teacher or class info.");
    return;
  }
  window.location.href = `report.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
}
window.goToReport = goToReport;

function checkAdminAuth() {
  if (localStorage.getItem('isAdmin') !== 'true') {
    showAlert("Unauthorized access. Redirecting to login.");
    window.location.href = "login.html";
    return false;
  }
  return true;
}

window.showAlert = function (msg) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.className = 'toast align-items-center text-white bg-dark border-0 show mb-2';
  toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" onclick="this.parentElement.parentElement.remove()"></button></div>`;
  toastContainer.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 3000);
};

function openDB() {
  return Promise.resolve();
}

function testDatabaseConnection() {
  try {
    const testKey = '__db_test_key__';
    localStorage.setItem(testKey, 'test_val');
    const val = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    const badge = document.getElementById('dbStatusBadge');
    if (badge && val === 'test_val') {
      badge.className = 'badge bg-success';
      badge.innerHTML = '<i class="bi bi-database-check"></i> DB Connected';
    } else if (badge) {
      badge.className = 'badge bg-danger';
      badge.innerHTML = '<i class="bi bi-database-exclamation"></i> DB Error';
    }
  } catch (e) {
    const badge = document.getElementById('dbStatusBadge');
    if (badge) {
      badge.className = 'badge bg-danger';
      badge.innerHTML = '<i class="bi bi-database-x"></i> DB Disconnected';
    }
  }
}

function getAll(store) {
  return new Promise((resolve) => {
    try {
      const data = localStorage.getItem('attendanceDB_' + store);
      resolve(data ? JSON.parse(data) : []);
    } catch (e) {
      console.error("Error loading store: " + store, e);
      resolve([]);
    }
  });
}

function save(store, val) {
  return new Promise((resolve) => {
    try {
      const data = localStorage.getItem('attendanceDB_' + store);
      let items = [];
      try {
        items = data ? JSON.parse(data) : [];
      } catch (parseErr) {
        console.error("Error parsing store: " + store + " during save. Resetting store.", parseErr);
      }
      let keyPath = store === 'holidays' ? 'date' : 'id';

      if (store === 'attendance' || store === 'logs') {
        if (!val._id) val._id = Date.now() + Math.random().toString().substring(2, 6);
        items.push(val);
      } else {
        const index = items.findIndex(item => item[keyPath] === val[keyPath]);
        if (index !== -1) items[index] = val;
        else items.push(val);
      }
      localStorage.setItem('attendanceDB_' + store, JSON.stringify(items));
      resolve(true);
    } catch (e) {
      console.error("Error saving store: " + store, e);
      resolve(false);
    }
  });
}

function remove(store, key) {
  return new Promise((resolve) => {
    try {
      const data = localStorage.getItem('attendanceDB_' + store);
      if (!data) return resolve(true);
      let items = [];
      try {
        items = JSON.parse(data);
      } catch (parseErr) {
        console.error("Error parsing store: " + store + " during remove.", parseErr);
        return resolve(true);
      }
      let keyPath = store === 'holidays' ? 'date' : 'id';
      if (store === 'attendance' || store === 'logs') keyPath = '_id';
      items = items.filter(item => item[keyPath] !== key);
      localStorage.setItem('attendanceDB_' + store, JSON.stringify(items));
      resolve(true);
    } catch (e) {
      console.error("Error removing key: " + key + " from store: " + store, e);
      resolve(false);
    }
  });
}

function add(store, val) {
  return save(store, val);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

async function addLog({ type, message, date = formatDate(new Date()), classId = '', details = {} }) {
  await save('logs', {
    type,
    message,
    date,
    classId,
    ...details
  });
}

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}


// ==========================================
// 2. Login Page Module
// ==========================================

function handleAdminLogin() {
  const password = prompt("Enter Admin Password:");
  if (password === "admin") {
    localStorage.setItem('isAdmin', 'true');
    window.location.href = "admin.html";
  } else if (password !== null && password !== "") {
    showAlert("Incorrect Password!");
  }
}

function toggleFields() {
  console.log("toggleFields called");
  try {
    const teacherRadio = document.querySelector('input[name="userType"][value="teacher"]');
    console.log("Teacher radio element:", teacherRadio);
    if (!teacherRadio) {
      console.warn("Teacher radio element not found in DOM!");
      return;
    }
    const isTeacher = teacherRadio.checked;
    console.log("isTeacher value:", isTeacher);
    
    const studentIdGroup = document.getElementById('studentIdGroup');
    const teacherIdGroup = document.getElementById('teacherIdGroup');
    const passwordGroup = document.getElementById('passwordGroup');

    if (!studentIdGroup || !teacherIdGroup || !passwordGroup) {
      console.warn("One or more field groups not found in DOM!", {
        studentIdGroup: !!studentIdGroup,
        teacherIdGroup: !!teacherIdGroup,
        passwordGroup: !!passwordGroup
      });
      return;
    }

    studentIdGroup.style.display = isTeacher ? 'none' : 'block';
    teacherIdGroup.style.display = isTeacher ? 'block' : 'none';
    passwordGroup.style.display = isTeacher ? 'block' : 'none';
    
    console.log("Fields toggled. Student ID display:", studentIdGroup.style.display);
  } catch (e) {
    console.error("Exception in toggleFields:", e);
  }
}

async function loadClasses() {
  console.log("loadClasses called");
  try {
    const classes = await getAll('classes');
    console.log("Loaded classes list:", classes);
    const classSelect = document.getElementById('classid');
    if (!classSelect) {
      console.warn("Class select input not found!");
      return;
    }
    classSelect.innerHTML = '<option value="" disabled selected>-- Select Class --</option>';
    classes.forEach(cls => {
      const option = document.createElement('option');
      option.value = cls.id;
      option.textContent = cls.id + (cls.name ? ` - ${cls.name}` : '');
      classSelect.appendChild(option);
    });
    console.log("Class select options populated.");
  } catch (e) {
    console.error("Exception in loadClasses:", e);
  }
}

function initLoginPage() {
  console.log("initLoginPage started");
  loadClasses();
  toggleFields();

  // Alt+A Secret Code to reveal Admin Login Button
  document.addEventListener('keydown', function (event) {
    if (event.altKey && (event.key === 'a' || event.key === 'A')) {
      const adminBtn = document.getElementById('adminLoginBtn');
      if (adminBtn) {
        adminBtn.style.display = adminBtn.style.display === 'none' ? 'block' : 'none';
      }
    }
  });

  const userTypeRadios = document.querySelectorAll('input[name="userType"]');
  console.log("userTypeRadios matched:", userTypeRadios.length);
  userTypeRadios.forEach(radio => {
    radio.addEventListener('change', toggleFields);
  });

  document.getElementById('adminLoginBtn')?.addEventListener('click', handleAdminLogin);

  document.getElementById('loginForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const isTeacher = document.querySelector('input[name="userType"][value="teacher"]').checked;
    const classId = document.getElementById('classid').value;

    if (!classId) {
      return showAlert('Please select a class.');
    }

    if (isTeacher) {
      const teacherId = document.getElementById('teacherid').value.trim();
      const password = document.getElementById('password').value;

      if (!teacherId || !password) return showAlert('Please fill all teacher fields.');

      const teachers = await getAll('teachers');
      const teacher = teachers.find(t => t.id === teacherId && t.password === password);

      if (teacher) {
        localStorage.setItem('teacherid', teacherId);
        localStorage.setItem('classid', classId);
        window.location.href = `teacherlogin.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
      } else {
        showAlert('Invalid Teacher ID or Password.');
      }
    } else {
      const studentId = document.getElementById('studentid').value.trim();

      if (!studentId) return showAlert('Please fill all student fields.');

      const students = await getAll('students');
      const student = students.find(s => s.id === studentId && s.classId === classId);

      if (student) {
        localStorage.setItem('studentid', studentId);
        window.location.href = `studentlogin.html?studentid=${encodeURIComponent(studentId)}`;
      } else {
        showAlert('Student not found in this class.');
      }
    }
  });
}


// ==========================================
// 3. Admin Dashboard Module
// ==========================================

let classes = [];
let students = [];
let teachers = [];
let holidays = [];
let logs = [];
let attendanceRecordsAll = [];

function calculateClassAttendanceSummary(classes, students, attendanceRecordsAll, date) {
  const results = [];
  classes.forEach(cls => {
    const classId = cls.id;
    const studentsInClass = students.filter(s => s.classId === classId || s.classid === classId);
    const totalStudents = studentsInClass.length;
    if (totalStudents === 0) {
      results.push({
        classId,
        totalStudents: 0,
        totalPresent: 0,
        averageAttendancePercentage: null
      });
      return;
    }
    const attendanceForDate = attendanceRecordsAll.filter(r =>
      ((r.classId === classId || r.classid === classId) && r.date === date)
    );

    if (attendanceForDate.length === 0) {
      results.push({
        classId,
        totalStudents,
        totalPresent: 0,
        averageAttendancePercentage: null,
        status: 'Not Marked'
      });
      return;
    }

    let presentCount = 0;
    studentsInClass.forEach(student => {
      const adminRec = attendanceForDate.find(r =>
        (r.studentId === student.id || r.studentid === student.id) && r.markedByAdmin === true);
      const teacherRec = attendanceForDate.find(r =>
        (r.studentId === student.id || r.studentid === student.id) && (!r.markedByAdmin || r.markedByAdmin === false));
      const status = adminRec ? adminRec.status : (teacherRec ? teacherRec.status : 'Absent');
      if (status === 'Present') presentCount++;
    });

    const avgAttendancePercent = (presentCount / totalStudents) * 100;

    results.push({
      classId,
      totalStudents,
      totalPresent: presentCount,
      averageAttendancePercentage: Math.round(avgAttendancePercent * 100) / 100
    });
  });
  return results;
}

function renderClassAttendanceSummary(date) {
  const container = document.getElementById('classAttendanceSummary');
  if (!container) return;

  const summary = calculateClassAttendanceSummary(classes, students, attendanceRecordsAll, date);

  if (!summary.length) {
    container.innerHTML = "<p>No classes available</p>";
    return;
  }

  let html = `
  <div class="table-responsive">
    <table class="table table-bordered table-striped align-middle text-center">
      <thead class="table-dark">
        <tr>
          <th>Class ID</th>
          <th>Total Students</th>
          <th>Total Present</th>
          <th>Avg. Attendance (%)</th>
        </tr>
      </thead>
      <tbody>`;

  summary.forEach(row => {
    html += `
      <tr>
        <td>${row.classId}</td>
        <td>${row.totalStudents}</td>
        <td>${row.totalPresent}</td>
        <td>${row.averageAttendancePercentage !== null ? row.averageAttendancePercentage.toFixed(2) + "%" : (row.status === 'Not Marked' ? 'Not Marked' : 'N/A')}</td>
      </tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function loadAllAdminData() {
  testDatabaseConnection();
  [classes, students, teachers, holidays, logs, attendanceRecordsAll] = await Promise.all([
    getAll('classes'),
    getAll('students'),
    getAll('teachers'),
    getAll('holidays'),
    getAll('logs'),
    getAll('attendance')
  ]);
  renderClasses();
  renderStudentTable();
  renderTeacherTable();
  renderHolidays();
  renderLogs();
  populateClassDropdowns();

  const dateInput = document.getElementById('attendanceDateFilter');
  if (dateInput && !dateInput.value) {
    dateInput.value = formatDate(new Date());
  }
  renderAttendanceTable();

  const date = dateInput?.value || formatDate(new Date());
  renderClassAttendanceSummary(date);
}

function renderClasses() {
  const totalEl = document.getElementById("totalClasses");
  if (totalEl) totalEl.textContent = classes.length;

  const container = document.getElementById("classSummaryContainer");
  if (container) {
    let containerHTML = "";
    classes.forEach(cls => {
      const studentsCount = students.filter(st => st.classId === cls.id).length;
      const classTeacher = teachers.find(
        t => t.subject && cls.name && cls.name.includes(t.subject)
      )?.name || "Not Assigned";
      containerHTML += `<div class="col-md-4"><div class="card p-3">
    <h6 class="card-title">Class ID: ${cls.id}${cls.name ? ` <span class="text-secondary">(${cls.name})</span>` : ""}</h6>
    <ul class="list-group list-group-flush">
        <li class="list-group-item">Class Teacher: <strong>${classTeacher}</strong></li>
        <li class="list-group-item">Total Students: <strong>${studentsCount}</strong></li>
    </ul></div></div>`;
    });
    container.innerHTML = containerHTML;
  }

  const classList = document.getElementById("classList");
  if (classList) {
    let classListHTML = "";
    classes.forEach((cls) => {
      const studentsCount = students.filter(st => st.classId === cls.id).length;
      classListHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
    <div><strong>${cls.id}</strong>${cls.name ? ` - ${cls.name}` : ""}<span class="ms-2 text-muted">Students: ${studentsCount}</span></div>
    <button class="btn btn-sm btn-danger" onclick="deleteClass('${cls.id}')">Delete</button>
  </li>`;
    });
    classList.innerHTML = classListHTML;
  }
}

function renderStudentTable() {
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;
  const filterClass = document.getElementById("studentClassFilter")?.value;
  let filteredStudents = filterClass ? students.filter(s => s.classId === filterClass) : students;
  tbody.innerHTML = "";
  if (!filteredStudents.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No students found for this selection.</td></tr>`;
    return;
  }
  let tableHTML = "";
  filteredStudents.forEach(stu => {
    tableHTML += `<tr data-id="${stu.id}">
  <td class="editable" data-field="id">${stu.id}</td>
  <td class="editable" data-field="name">${stu.name}</td>
  <td class="editable" data-field="classId">${stu.classId}</td>
  <td class="editable" data-field="contact">${stu.contact || ""}</td>
  <td class="editable" data-field="gender">${stu.gender || ""}</td>
  <td>
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-primary edit-inline">Edit</button>
      <button class="btn btn-sm btn-success save-inline" style="display:none;">Save</button>
      <button class="btn btn-sm btn-danger delete-inline">Delete</button>
    </div>
  </td>
</tr>`;
  });
  tbody.innerHTML = tableHTML;

  tbody.querySelectorAll('.edit-inline').forEach(btn => {
    btn.onclick = function () {
      const tr = btn.closest('tr');
      tr.querySelectorAll('.editable').forEach(td => {
        const field = td.getAttribute('data-field');
        let value = td.textContent;
        if (field === "id") {
          td.innerHTML = `<input type="text" class="form-control form-control-sm" value="${value}">`;
        } else if (field === "gender") {
          td.innerHTML = `<select class="form-select form-select-sm">
        <option value="Male"${value === "Male" ? " selected" : ""}>Male</option>
        <option value="Female"${value === "Female" ? " selected" : ""}>Female</option>
        <option value="Other"${value === "Other" ? " selected" : ""}>Other</option>
      </select>`;
        } else if (field === "classId") {
          td.innerHTML = `<select class="form-select form-select-sm">
        ${classes.map(c => `<option value="${c.id}"${value === c.id ? " selected" : ""}>${c.id}</option>`).join('')}
      </select>`;
        } else {
          td.innerHTML = `<input type="text" class="form-control form-control-sm" value="${value}">`;
        }
      });
      tr.querySelector('.save-inline').style.display = '';
      btn.style.display = 'none';
    };
  });

  tbody.querySelectorAll('.save-inline').forEach(btn => {
    btn.onclick = async function () {
      const tr = btn.closest('tr');
      const oldId = tr.getAttribute('data-id');
      const id = tr.querySelector('[data-field="id"] input')?.value || tr.querySelector('[data-field="id"]').textContent;
      const name = tr.querySelector('[data-field="name"] input')?.value || tr.querySelector('[data-field="name"]').textContent;
      const classId = tr.querySelector('[data-field="classId"] select')?.value || tr.querySelector('[data-field="classId"]').textContent;
      const contact = tr.querySelector('[data-field="contact"] input')?.value || tr.querySelector('[data-field="contact"]').textContent;
      const gender = tr.querySelector('[data-field="gender"] select')?.value || tr.querySelector('[data-field="gender"]').textContent;
      if (![id, name, classId, contact, gender].every(Boolean)) return showAlert("Please fill all fields.");
      if (id !== oldId && students.some(s => s.id === id)) return showAlert(`Student ID "${id}" already exists.`);
      if (id !== oldId) await remove('students', oldId);
      await save('students', { id, name, classId, contact, gender });
      await addLog({ type: 'Student', message: `Edited student "${name}" (${id}) inline`, classId });
      await loadAllAdminData();
    };
  });

  tbody.querySelectorAll('.delete-inline').forEach(btn => {
    btn.onclick = function () {
      const tr = btn.closest('tr');
      const id = tr.getAttribute('data-id');
      window.deleteStudent(id);
    };
  });
}

function renderTeacherTable() {
  const tbody = document.getElementById("teacherTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!teachers.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No teachers found.</td></tr>`;
    return;
  }
  let tableHTML = "";
  teachers.forEach(t => {
    tableHTML += `<tr>
  <td>${t.id}</td>
  <td>${t.name}</td>
  <td>${t.contact || ""}</td>
  <td>${t.subject || ""}</td>
  <td>********</td>
  <td>
    <button class="btn btn-sm btn-primary" onclick="editTeacher('${t.id}')">Edit</button>
    <button class="btn btn-sm btn-danger" onclick="deleteTeacher('${t.id}')">Delete</button>
  </td>
</tr>`;
  });
  tbody.innerHTML = tableHTML;
}

function renderHolidays() {
  const totalHolidays = document.getElementById("totalHolidays");
  if (totalHolidays) totalHolidays.textContent = holidays.length;
  const holidayList = document.getElementById("holidayList");
  if (holidayList) {
    holidayList.innerHTML = holidays.map(h =>
      `<li class="list-group-item d-flex justify-content-between align-items-center">
    <span><strong>${h.date}</strong> - ${h.reason}</span>
    <button class="btn btn-sm btn-danger" onclick="deleteHoliday('${h.date}')">Delete</button>
  </li>`).join('');
  }
}

function renderLogs() {
  const logsList = document.getElementById("logsList");
  if (!logsList) return;
  let filtered = logs;
  const filterDate = document.getElementById("logFilterDate")?.value;
  const filterType = document.getElementById("logTypeFilter")?.value;
  const filterClass = document.getElementById("logClassFilter")?.value;
  if (filterDate) filtered = filtered.filter(log => log.date === filterDate);
  if (filterType) filtered = filtered.filter(log => log.type === filterType);
  if (filterClass) filtered = filtered.filter(log => log.classId === filterClass || (log.message && log.message.includes(filterClass)));
  if (!filtered.length) {
    logsList.innerHTML = `<li class="list-group-item text-center text-muted">No logs for this selection.</li>`;
    return;
  }
  logsList.innerHTML = filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(log =>
      `<li class="list-group-item"><span class="badge bg-info me-2">${log.type}</span> [${log.date}] ${log.message}</li>`
    ).join('');
}

function populateClassDropdowns() {
  const studentClassFilter = document.getElementById("studentClassFilter");
  if (studentClassFilter) {
    const val = studentClassFilter.value;
    studentClassFilter.innerHTML = `<option value="">All Classes</option>` +
      classes.map(c => `<option value="${c.id}"${val === c.id ? " selected" : ""}>${c.id} - ${c.name || ""}</option>`).join('');
  }
  const newStudentClass = document.getElementById("newStudentClass");
  if (newStudentClass) {
    newStudentClass.innerHTML = `<option value="">Select Class</option>` +
      classes.map(c => `<option value="${c.id}">${c.id} - ${c.name || ""}</option>`).join('');
  }
  const attendanceClassFilter = document.getElementById('attendanceClassFilter');
  if (attendanceClassFilter) {
    const val = attendanceClassFilter.value;
    attendanceClassFilter.innerHTML = `<option value="">Select Class</option>` +
      classes.map(c => `<option value="${c.id}"${val === c.id ? " selected" : ""}>${c.id} - ${c.name || ""}</option>`).join('');
  }
  const logClassFilter = document.getElementById("logClassFilter");
  if (logClassFilter) {
    const val = logClassFilter.value;
    logClassFilter.innerHTML = `<option value="">All Classes</option>` +
      classes.map(c => `<option value="${c.id}"${val === c.id ? " selected" : ""}>${c.id} - ${c.name || ""}</option>`).join('');
  }
}

function confirmAction(message, onConfirm) {
  document.getElementById('confirmModalMsg').textContent = message;
  const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
  modal.show();
  const okBtn = document.getElementById('confirmModalOk');
  okBtn.onclick = () => {
    modal.hide();
    onConfirm();
  };
}

async function addClass() {
  const id = document.getElementById("newClassInput").value.trim();
  const name = document.getElementById("newClassNameInput").value.trim();
  if (!id || !name) return showAlert("Please enter both Class ID and Class Name.");
  if (classes.some(cls => cls.id === id)) return showAlert(`Class ID "${id}" already exists.`);
  confirmAction(`Add class "${name}" (${id})?`, async () => {
    await save('classes', { id, name });
    await addLog({ type: 'Class', message: `Added class "${name}" (${id})`, classId: id });
    document.getElementById("newClassInput").value = "";
    document.getElementById("newClassNameInput").value = "";
    await loadAllAdminData();
  });
}

async function deleteClass(id) {
  confirmAction(`Are you sure you want to delete class ${id}?`, async () => {
    await remove('classes', id);
    await addLog({ type: 'Class', message: `Deleted class "${id}"`, classId: id });
    await loadAllAdminData();
  });
}

async function addStudent() {
  const id = document.getElementById("newStudentID").value.trim();
  const name = document.getElementById("newStudentName").value.trim();
  const classId = document.getElementById("newStudentClass").value;
  const contact = document.getElementById("newStudentContact").value.trim();
  const gender = document.getElementById("newStudentGender").value;
  if (![id, name, classId, contact, gender].every(Boolean)) return showAlert("Please fill all fields.");
  if (students.some(s => s.id === id)) return showAlert(`Student ID "${id}" already exists.`);
  if (!classes.some(c => c.id === classId)) return showAlert(`Class ID "${classId}" is invalid.`);
  confirmAction(`Add student "${name}" (${id}) to class ${classId}?`, async () => {
    await save('students', { id, name, classId, contact, gender });
    await addLog({ type: 'Student', message: `Added student "${name}" (${id}) in Class ${classId}`, classId });
    ["newStudentID", "newStudentName", "newStudentClass", "newStudentContact", "newStudentGender"].forEach(idBox => {
      const el = document.getElementById(idBox); if (el) el.value = "";
    });
    await loadAllAdminData();
  });
}

async function deleteStudent(id) {
  confirmAction(`Are you sure you want to delete student ${id}?`, async () => {
    await remove('students', id);
    await addLog({ type: 'Student', message: `Deleted student ID "${id}"`, classId: "(unknown)" });
    await loadAllAdminData();
  });
}

async function addTeacher() {
  const id = document.getElementById("newTeacherID").value.trim();
  const name = document.getElementById("newTeacherName").value.trim();
  const contact = document.getElementById("newTeacherContact").value.trim();
  const subject = document.getElementById("newTeacherSubject").value.trim();
  const password = document.getElementById("newTeacherPassword").value.trim();
  if (![id, name, contact, subject, password].every(Boolean)) return showAlert("Please fill all fields.");
  if (teachers.some(t => t.id === id)) return showAlert(`Teacher ID "${id}" already exists.`);
  confirmAction(`Add teacher "${name}" (${id})?`, async () => {
    await save('teachers', { id, name, contact, subject, password });
    await addLog({ type: 'Teacher', message: `Added teacher "${name}" (${id})`, classId: "(n/a)" });
    ["newTeacherID", "newTeacherName", "newTeacherContact", "newTeacherSubject", "newTeacherPassword"].forEach(fld => {
      const el = document.getElementById(fld); if (el) el.value = "";
    });
    await loadAllAdminData();
  });
}

async function deleteTeacher(id) {
  confirmAction(`Are you sure you want to delete teacher ${id}?`, async () => {
    await remove('teachers', id);
    await addLog({ type: 'Teacher', message: `Deleted teacher ID "${id}"`, classId: "(n/a)" });
    await loadAllAdminData();
  });
}

async function addHoliday() {
  const date = document.getElementById("newHolidayDate").value;
  const reason = document.getElementById("newHolidayReason").value.trim();
  if (!date || !reason) return showAlert("Please fill both date and reason.");
  if (holidays.some(h => h.date === date)) return showAlert(`Holiday on "${date}" already exists.`);
  confirmAction(`Add holiday "${reason}" on ${date}?`, async () => {
    await save('holidays', { date, reason });
    await addLog({ type: 'Holiday', message: `Added holiday "${reason}" on ${date}`, date });
    document.getElementById("newHolidayDate").value = "";
    document.getElementById("newHolidayReason").value = "";
    await loadAllAdminData();
  });
}

async function deleteHoliday(date) {
  confirmAction(`Are you sure you want to delete holiday on ${date}?`, async () => {
    await remove('holidays', date);
    await addLog({ type: 'Holiday', message: `Deleted holiday on ${date}`, date });
    await loadAllAdminData();
  });
}

function renderAttendanceTable() {
  const attendanceClassFilter = document.getElementById('attendanceClassFilter');
  const classId = attendanceClassFilter ? attendanceClassFilter.value : "";
  const dateInput = document.getElementById('attendanceDateFilter');
  const date = dateInput ? dateInput.value : "";
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody || !classId || !date) return;
  const studentsInClass = students.filter(s => s.classId === classId);
  if (!studentsInClass.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No students in this class.</td></tr>`;
    return;
  }
  const attendanceForDate = attendanceRecordsAll.filter(r => r.classId === classId && r.date === date);
  let tableHTML = "";
  studentsInClass.forEach(student => {
    const adminRecord = attendanceForDate.find(r => r.studentId === student.id && r.markedByAdmin === true);
    const teacherRecord = attendanceForDate.find(r => r.studentId === student.id && !r.markedByAdmin);
    const teacherStatus = teacherRecord ? teacherRecord.status : "Not marked";
    const adminStatus = adminRecord ? adminRecord.status : teacherStatus;
    const isToday = (date === formatDate(new Date()));
    const disableSelect = !isToday || !!adminRecord;
    tableHTML += `<tr>
  <td>${student.id}</td>
  <td>${student.name}</td>
  <td>
    <select class="form-select form-select-sm attendance-status" data-studentid="${student.id}" ${disableSelect ? 'disabled' : ''}>
      <option value="" ${adminStatus === "" ? "selected" : ""}>Select</option>
      <option value="Present" ${adminStatus === "Present" ? "selected" : ""}>Present</option>
      <option value="Absent" ${adminStatus === "Absent" ? "selected" : ""}>Absent</option>
      <option value="Holiday" disabled>Holiday</option>
    </select>
  </td>
</tr>`;
  });
  tbody.innerHTML = tableHTML;
  const saveBtn = document.getElementById('saveAttendanceBtn');
  if (saveBtn) saveBtn.disabled = !document.querySelector('.attendance-status:not([disabled])');
}

function populateEditStudentClassDropdown(selectedId) {
  const select = document.getElementById("editStudentClass");
  if (!select) return;
  select.innerHTML = classes.map(c =>
    `<option value="${c.id}"${c.id === selectedId ? " selected" : ""}>${c.id} - ${c.name || ""}</option>`
  ).join('');
}

function editStudent(id) {
  const student = students.find(s => s.id === id);
  if (!student) return showAlert("Student not found.");
  document.getElementById("editStudentID").value = student.id;
  document.getElementById("editStudentName").value = student.name;
  document.getElementById("editStudentContact").value = student.contact || "";
  document.getElementById("editStudentGender").value = student.gender || "Male";
  populateEditStudentClassDropdown(student.classId);
  const modal = new bootstrap.Modal(document.getElementById("editStudentModal"));
  modal.show();
}

function editTeacher(id) {
  const teacher = teachers.find(t => t.id === id);
  if (!teacher) return showAlert("Teacher not found.");
  document.getElementById("editTeacherID").value = teacher.id;
  document.getElementById("editTeacherName").value = teacher.name;
  document.getElementById("editTeacherContact").value = teacher.contact || "";
  document.getElementById("editTeacherSubject").value = teacher.subject || "";
  document.getElementById("editTeacherPassword").value = teacher.password || "";
  const modal = new bootstrap.Modal(document.getElementById("editTeacherModal"));
  modal.show();
}

// Bind to window for inline calls
window.addClass = addClass;
window.deleteClass = deleteClass;
window.addStudent = addStudent;
window.deleteStudent = deleteStudent;
window.addTeacher = addTeacher;
window.deleteTeacher = deleteTeacher;
window.addHoliday = addHoliday;
window.deleteHoliday = deleteHoliday;
window.editStudent = editStudent;
window.editTeacher = editTeacher;
window.renderAttendanceTable = renderAttendanceTable;

function initAdminPage() {
  document.getElementById('saveAttendanceBtn')?.addEventListener('click', async () => {
    const attendanceClassFilter = document.getElementById('attendanceClassFilter');
    const classId = attendanceClassFilter ? attendanceClassFilter.value : "";
    const dateInput = document.getElementById('attendanceDateFilter');
    const date = dateInput ? dateInput.value : "";
    if (!classId || !date) return showAlert("Please select class and date first.");

    const selects = document.querySelectorAll('.attendance-status:not(:disabled)');
    if (!selects.length) return showAlert("No editable attendance records found.");

    let count = 0;
    for (const select of selects) {
      const studentId = select.getAttribute('data-studentid');
      const status = select.value;
      if (!status) continue;
      const record = {
        classId,
        studentId,
        date,
        status,
        markedByAdmin: true
      };
      await save('attendance', record);
      count++;
    }
    await addLog({ type: 'Attendance', message: `Admin saved attendance for class ${classId} on ${date} (${count} students)`, classId, date });
    showAlert('Attendance saved successfully.');
    attendanceRecordsAll = await getAll('attendance');
    renderAttendanceTable();
    renderClassAttendanceSummary(date);
    document.getElementById('saveAttendanceBtn').disabled = true;
  });

  document.getElementById("saveEditStudentBtn")?.addEventListener("click", async function () {
    const id = document.getElementById("editStudentID").value;
    const name = document.getElementById("editStudentName").value.trim();
    const classId = document.getElementById("editStudentClass").value;
    const contact = document.getElementById("editStudentContact").value.trim();
    const gender = document.getElementById("editStudentGender").value;
    if (![id, name, classId, contact, gender].every(Boolean)) return showAlert("Please fill all fields.");
    await save('students', { id, name, classId, contact, gender });
    await addLog({ type: 'Student', message: `Edited student "${name}" (${id})`, classId });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("editStudentModal")).hide();
    await loadAllAdminData();
  });

  document.getElementById("saveEditTeacherBtn")?.addEventListener("click", async function () {
    const id = document.getElementById("editTeacherID").value;
    const name = document.getElementById("editTeacherName").value.trim();
    const contact = document.getElementById("editTeacherContact").value.trim();
    const subject = document.getElementById("editTeacherSubject").value.trim();
    const password = document.getElementById("editTeacherPassword").value.trim();
    if (![id, name, contact, subject, password].every(Boolean)) return showAlert("Please fill all fields.");
    await save('teachers', { id, name, contact, subject, password });
    await addLog({ type: 'Teacher', message: `Edited teacher "${name}" (${id})`, classId: "(n/a)" });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("editTeacherModal")).hide();
    await loadAllAdminData();
  });

  document.getElementById("studentClassFilter")?.addEventListener("change", renderStudentTable);
  document.getElementById("attendanceClassFilter")?.addEventListener("change", renderAttendanceTable);
  document.getElementById("attendanceDateFilter")?.addEventListener("change", (e) => {
    renderAttendanceTable();
    const dt = e.target.value || formatDate(new Date());
    renderClassAttendanceSummary(dt);
  });
  document.getElementById("logFilterDate")?.addEventListener("change", renderLogs);
  document.getElementById("logTypeFilter")?.addEventListener("change", renderLogs);
  document.getElementById("logClassFilter")?.addEventListener("change", renderLogs);

  loadAllAdminData();
}


// ==========================================
// 4. Teacher Dashboard Module
// ==========================================

async function loadTeacherInfo() {
  testDatabaseConnection();
  let teacherId = getQueryParam('teacherid') || localStorage.getItem('teacherid');
  let classId = getQueryParam('classid') || localStorage.getItem('classid');

  if (!teacherId || !classId) {
    showAlert("Missing teacher ID or class ID. Please login again.");
    window.location.href = "login.html";
    return;
  }

  await openDB();
  const teachers = await getAll('teachers');
  const teacher = teachers.find(t => (t.teacherid || t.id) === teacherId);
  let teacherDisplay = teacherId;
  if (teacher && teacher.name) teacherDisplay = `${teacher.name} (${teacherId})`;

  const classes = await getAll('classes');
  const cls = classes.find(c => (c.classid || c.id) === classId);
  let classDisplay = classId;
  if (cls && cls.name) classDisplay = `${cls.name} (${classId})`;

  document.getElementById('username').textContent = teacherDisplay;
  document.getElementById('class-id').textContent = classDisplay;
}

function goToAttendance() {
  let teacherId = getQueryParam('teacherid') || localStorage.getItem('teacherid');
  let classId = getQueryParam('classid') || localStorage.getItem('classid');
  if (!teacherId || !classId) {
    showAlert("Missing teacher or class info.");
    return;
  }
  window.location.href = `attendance.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
}

function updateDateTime() {
  const dateEl = document.getElementById("date-time");
  if (dateEl) dateEl.textContent = new Date().toLocaleString();
}

window.goToAttendance = goToAttendance;

function initTeacherLoginPage() {
  loadTeacherInfo();
  updateDateTime();
  setInterval(updateDateTime, 60000);
}


// ==========================================
// 5. Attendance Mark Module
// ==========================================

let currentTeacherId = '';
let currentClassId = '';
let classStudents = [];

async function initAttendancePage() {
  testDatabaseConnection();
  currentTeacherId = getQueryParam('teacherid') || localStorage.getItem('teacherid');
  currentClassId = getQueryParam('classid') || localStorage.getItem('classid');

  if (!currentTeacherId || !currentClassId) {
    showAlert('Missing teacher ID or class ID. Redirecting to login.');
    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    return;
  }

  const teachers = await getAll('teachers');
  const teacher = teachers.find(t => t.id === currentTeacherId);
  const teacherDisplay = teacher ? `${teacher.name} (${currentTeacherId})` : currentTeacherId;

  const classes = await getAll('classes');
  const cls = classes.find(c => c.id === currentClassId);
  const classDisplay = cls ? `${cls.name || cls.id} (${currentClassId})` : currentClassId;

  document.getElementById('username').textContent = teacherDisplay;
  document.getElementById('class-id').textContent = classDisplay;

  await loadStudents();

  // Wire event handlers
  document.getElementById('selectAllCheckbox')?.addEventListener('change', function(e) {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
  });

  document.getElementById('attendanceForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    if (classStudents.length === 0) return showAlert('No students to mark.');
    const submitBtn = document.querySelector("#attendanceForm button[type='submit']");
    if (submitBtn && submitBtn.disabled) {
      return showAlert('Attendance already submitted today.');
    }
    confirmModal = new bootstrap.Modal(document.getElementById('submitConfirmModal'));
    confirmModal.show();
  });

  document.getElementById('confirmSubmitBtn')?.addEventListener('click', async () => {
    if (confirmModal) confirmModal.hide();
    const todayStr = formatDate(new Date());

    await clearAttendanceForToday(currentClassId, todayStr);

    const checkboxes = document.querySelectorAll('.student-checkbox');
    let presentCount = 0;
    let absentCount = 0;

    for (const cb of checkboxes) {
      const studentId = cb.getAttribute('data-studentid');
      const status = cb.checked ? 'Present' : 'Absent';
      
      if (cb.checked) presentCount++;
      else absentCount++;

      const record = {
        classId: currentClassId,
        studentId: studentId,
        date: todayStr,
        status: status,
        markedByAdmin: false
      };
      await save('attendance', record);
    }

    await addLog({
      type: 'Attendance',
      message: `Teacher marked attendance for class ${currentClassId} on ${todayStr} (${presentCount} Present, ${absentCount} Absent)`,
      classId: currentClassId,
      date: todayStr
    });

    showAlert('Attendance submitted successfully!');
    setTimeout(() => {
      window.location.href = `teacherlogin.html?teacherid=${encodeURIComponent(currentTeacherId)}&classid=${encodeURIComponent(currentClassId)}`;
    }, 1500);
  });
}

async function getYesterdayAttendance(classId) {
  const records = await getAll('attendance');
  const todayStr = formatDate(new Date());

  const dates = [...new Set(records
    .filter(r => (r.classId === classId || r.classid === classId) && r.date < todayStr)
    .map(r => r.date)
  )].sort().reverse();

  if (dates.length === 0) {
    return null;
  }

  const lastDate = dates[0];
  const lastRecords = records.filter(r => (r.classId === classId || r.classid === classId) && r.date === lastDate);
  
  const statusMap = {};
  lastRecords.forEach(r => {
    const sid = r.studentId || r.studentid;
    if (!statusMap[sid] || r.markedByAdmin) {
      statusMap[sid] = r.status;
    }
  });

  return { date: lastDate, statusMap };
}

async function loadStudents() {
  const allStudents = await getAll('students');
  classStudents = allStudents.filter(s => s.classId === currentClassId || s.classid === currentClassId);

  const tbody = document.getElementById('studentTable');
  if (!tbody) return;
  if (classStudents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No students registered in this class.</td></tr>`;
    return;
  }

  const prevAttendance = await getYesterdayAttendance(currentClassId);
  
  const todayStr = formatDate(new Date());
  const holidays = await getAll('holidays');
  const isHolidayToday = holidays.some(h => h.date === todayStr);

  // Check if today's attendance has already been submitted (by teacher or admin)
  const records = await getAll('attendance');
  const todayRecords = records.filter(r => 
    (r.classId === currentClassId || r.classid === currentClassId) && 
    r.date === todayStr
  );
  const isAlreadySubmitted = todayRecords.length > 0;

  const submitBtn = document.querySelector("#attendanceForm button[type='submit']");
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');

  if (isHolidayToday) {
    if (submitBtn) {
      submitBtn.disabled = true;
      const todayHoliday = holidays.find(h => h.date === todayStr);
      submitBtn.textContent = `Today is a Holiday (${todayHoliday?.reason || 'Holiday'})`;
      submitBtn.className = "btn btn-warning mt-3 px-4";
    }
    if (selectAllCheckbox) {
      selectAllCheckbox.disabled = true;
    }
  } else if (isAlreadySubmitted) {
    // Disable submit button and update text
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Attendance Already Submitted Today";
    }
    // Disable select all checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.disabled = true;
    }
  }

  let tableHTML = '';
  classStudents.forEach(student => {
    let prevStatus = 'N/A';
    let badgeClass = 'bg-secondary';
    
    if (prevAttendance && prevAttendance.statusMap[student.id]) {
      prevStatus = prevAttendance.statusMap[student.id];
      if (prevStatus === 'Present') badgeClass = 'bg-success';
      else if (prevStatus === 'Absent') badgeClass = 'bg-danger';
    }

    let isChecked = false;
    let isDisabled = false;

    if (isHolidayToday) {
      isDisabled = true;
    } else if (isAlreadySubmitted) {
      // Prioritize Admin edits over Teacher marking
      const adminRec = todayRecords.find(r => (r.studentId === student.id || r.studentid === student.id) && r.markedByAdmin);
      const teacherRec = todayRecords.find(r => (r.studentId === student.id || r.studentid === student.id) && !r.markedByAdmin);
      const studRec = adminRec || teacherRec;
      if (studRec && studRec.status === 'Present') {
        isChecked = true;
      }
      isDisabled = true;
    }

    tableHTML += `
      <tr>
        <td>
          <strong>${student.name}</strong>
          <div class="text-muted" style="font-size: 0.85em;">ID: ${student.id}</div>
        </td>
        <td class="text-center">
          <span class="badge ${badgeClass}">${prevStatus}</span>
        </td>
        <td class="text-center">
          <input type="checkbox" class="student-checkbox form-check-input" data-studentid="${student.id}" style="transform: scale(1.2);"${isChecked ? ' checked' : ''}${isDisabled ? ' disabled' : ''}>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = tableHTML;
}

async function clearAttendanceForToday(classId, date) {
  const records = await getAll('attendance');
  const filtered = records.filter(r => !((r.classId === classId || r.classid === classId) && r.date === date && !r.markedByAdmin));
  localStorage.setItem('attendanceDB_attendance', JSON.stringify(filtered));
}

async function confirmHoliday() {
  const reason = document.getElementById('holidayReason').value.trim();
  const password = document.getElementById('teacherPassword').value;

  if (!reason) return showAlert('Please provide a reason for the holiday.');
  if (!password) return showAlert('Please enter your password.');

  const teacherId = currentTeacherId || getQueryParam('teacherid') || localStorage.getItem('teacherid') || '';
  const classId = currentClassId || getQueryParam('classid') || localStorage.getItem('classid') || '';

  if (!teacherId || !classId) {
    return showAlert('Missing teacher credentials.');
  }

  const teachers = await getAll('teachers');
  const teacher = teachers.find(t => t.id === teacherId);

  if (!teacher || teacher.password !== password) {
    return showAlert('Invalid password. Unable to set holiday.');
  }

  const todayStr = formatDate(new Date());
  const holidayRecord = {
    date: todayStr,
    reason: reason
  };

  const holidays = await getAll('holidays');
  if (holidays.some(h => h.date === todayStr)) {
    bootstrap.Modal.getInstance(document.getElementById('holidayModal')).hide();
    return showAlert('Holiday already declared for today.');
  }

  await save('holidays', holidayRecord);
  await clearAttendanceForToday(classId, todayStr);

  const teacherName = teacher ? teacher.name : teacherId;
  await addLog({
    type: 'Holiday',
    message: `Teacher ${teacherName} (ID: ${teacherId}) declared Holiday on ${todayStr}. Reason: ${reason}`,
    classId: classId,
    date: todayStr
  });

  bootstrap.Modal.getOrCreateInstance(document.getElementById('holidayModal')).hide();
  showAlert('Holiday saved successfully!');
  
  setTimeout(() => {
    window.location.href = `teacherlogin.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
  }, 1500);
}

function updateAttendanceDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('date-time');
  if (dateEl) dateEl.textContent = now.toLocaleString();
}

function goBackToDashboard() {
  const teacherId = getQueryParam('teacherid') || localStorage.getItem('teacherid');
  const classId = getQueryParam('classid') || localStorage.getItem('classid');
  if (teacherId && classId) {
    window.location.href = `teacherlogin.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
  } else {
    window.location.href = 'login.html';
  }
}

window.confirmHoliday = confirmHoliday;
window.goBackToDashboard = goBackToDashboard;

function initAttendanceMarkPage() {
  initAttendancePage();
  updateAttendanceDateTime();
  setInterval(updateAttendanceDateTime, 1000);
}


// ==========================================
// 6. Reports Dashboard Module
// ==========================================

let attendanceRecords = [];
let holidayDatesSet = new Set();
let reportStudents = [];
let reportClasses = [];

function getClassId() {
  return getQueryParam('classid') || localStorage.getItem('classid') || '';
}

async function setTeacherAndClassInfo(classesList) {
  testDatabaseConnection();
  const urlParams = new URLSearchParams(window.location.search);
  const teacherId = urlParams.get('teacherid') || localStorage.getItem('teacherid');
  const classId = getClassId();

  if (!teacherId || !classId) {
    showAlert("Missing teacher ID or class ID. Please login again.");
    window.location.href = "login.html";
    return;
  }

  const teachers = await getAll('teachers');
  const teacher = teachers.find(t => t.id === teacherId);
  const teacherName = teacher ? teacher.name : teacherId;

  const cls = classesList.find(c => c.id === classId);
  const className = cls ? cls.name : classId;

  document.getElementById('username').textContent = `${teacherName} (${teacherId})`;
  document.getElementById('class-id').textContent = `${className} (${classId})`;
}

function dedupAttendance(records, classId) {
  const classRecords = records.filter(r => (r.classId === classId || r.classid === classId));
  const map = {};
  classRecords.forEach(r => {
    const key = `${r.studentId || r.studentid || r.id}|${r.date}`;
    if (!map[key] || r.markedByAdmin || (!map[key].markedByAdmin && !r.markedByAdmin)) {
      map[key] = r;
    }
  });
  return Object.values(map);
}

function renderAttendanceReport(filterDate) {
  const tbody = document.getElementById("attendanceReportTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  const classId = getClassId();
  
  const deduped = dedupAttendance(attendanceRecords, classId);
  let filtered = deduped;
  if (filterDate) {
    filtered = deduped.filter(r => r.date === filterDate);
  }
  
  filtered.sort((a, b) => b.date.localeCompare(a.date));
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No attendance records found for this selection.</td></tr>`;
    return;
  }
  
  let tableHTML = "";
  filtered.forEach(r => {
    const student = reportStudents.find(s => s.id === (r.studentId || r.studentid || r.id));
    const studentName = student ? student.name : `Unknown (${r.studentId || r.studentid || r.id})`;
    tableHTML += `<tr>
      <td>${r.date}</td>
      <td>${studentName}</td>
      <td><span class="badge ${r.status === 'Present' ? 'bg-success' : (r.status === 'Absent' ? 'bg-danger' : 'bg-secondary')}">${r.status}</span></td>
    </tr>`;
  });
  tbody.innerHTML = tableHTML;
}

function getOverallSummary() {
  const classId = getClassId();
  const classStudentIds = new Set(
    reportStudents
      .filter(s => s.classid === classId || s.classId === classId || s.class_id === classId)
      .map(s => s.studentid || s.id)
  );

  const deduped = dedupAttendance(attendanceRecords, classId);

  let present = 0, absent = 0;
  deduped.forEach(r => {
    if (!classStudentIds.has(r.studentId || r.studentid || r.id)) return;
    if (r.status === "Present") present++;
    else if (r.status === "Absent") absent++;
  });
  return { present, absent };
}

function renderAttendanceDoughnutChart() {
  const overall = getOverallSummary();
  const canvasEl = document.getElementById("attendanceDoughnutChart");
  if (!canvasEl) return;

  if (window.myDoughnutChart) {
    window.myDoughnutChart.destroy();
  }

  const ctx = canvasEl.getContext("2d");
  window.myDoughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Absent'],
      datasets: [{
        data: [overall.present, overall.absent],
        backgroundColor: ['rgba(54, 162, 235, 0.85)', 'rgba(255, 99, 132, 0.85)'],
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 16 }, color: '#333' }
        },
        title: {
          display: true,
          text: 'Overall Attendance Distribution',
          font: { size: 20 }
        },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 13 },
          formatter: (value, context) => {
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            return total ? `${((value / total) * 100).toFixed(1)}%` : "0%";
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return `${ctx.label}: ${value} (${total ? ((value / total) * 100).toFixed(1) : 0}%)`;
            }
          }
        }
      }
    },
    plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : []
  });
}

function groupByDate(records) {
  const grouped = {};
  const perDayPerStudent = {};
  const classId = getClassId();

  for (const r of records) {
    if (!(r.classId === classId || r.classid === classId)) continue;
    if (holidayDatesSet.has(r.date)) continue;
    const studentId = r.studentId || r.studentid || r.id;
    const date = r.date;
    const key = `${studentId}|${date}`;
    if (!perDayPerStudent[key] || r.markedByAdmin || (!perDayPerStudent[key].markedByAdmin && !r.markedByAdmin)) {
      perDayPerStudent[key] = r;
    }
  }

  Object.values(perDayPerStudent).forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = { Present: 0, Absent: 0 };
    if (r.status === "Present") grouped[r.date].Present++;
    if (r.status === "Absent") grouped[r.date].Absent++;
  });
  return grouped;
}

function renderDailyLineChart() {
  const grouped = groupByDate(attendanceRecords);
  const dates = Object.keys(grouped).sort();
  const presentCounts = dates.map(date => grouped[date].Present);
  const absentCounts = dates.map(date => grouped[date].Absent);

  const canvasEl = document.getElementById('dailyLineChart');
  if (!canvasEl) return;

  if (window.myLineChart) {
    window.myLineChart.destroy();
  }

  const ctx = canvasEl.getContext("2d");
  window.myLineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Present',
          data: presentCounts,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        },
        {
          label: 'Absent',
          data: absentCounts,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 14 }, color: '#333' }
        },
        title: {
          display: true,
          text: 'Attendance Over Time',
          font: { size: 18 }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getPrevDate() {
  const prev = new Date();
  prev.setDate(prev.getDate() - 1);
  return prev.toISOString().slice(0, 10);
}

function getStrength(date) {
  const classId = getClassId();
  const records = attendanceRecords.filter(r =>
    r.date === date &&
    (r.classId === classId || r.classid === classId)
  );
  const statusByStudent = {};
  for (const r of records) {
    const sid = r.studentId || r.studentid || r.id;
    if (!statusByStudent[sid] || r.markedByAdmin || (!statusByStudent[sid].markedByAdmin && !r.markedByAdmin)) {
      statusByStudent[sid] = r;
    }
  }
  return Object.values(statusByStudent).filter(r => r.status === "Present").length;
}

function isHoliday(date) {
  return holidayDatesSet.has(date);
}

function updateStrengthDisplays() {
  const today = getTodayDate();
  const prev = getPrevDate();

  const todayStrengthEl = document.getElementById("todayStrength");
  if (todayStrengthEl) {
    if (isHoliday(today)) {
      todayStrengthEl.textContent = `Today is a Holiday (${today})`;
    } else {
      todayStrengthEl.textContent = `Today's Strength (${today}): ${getStrength(today)}`;
    }
  }

  const prevDayStrengthEl = document.getElementById("prevDayStrength");
  if (prevDayStrengthEl) {
    if (isHoliday(prev)) {
      prevDayStrengthEl.textContent = `Yesterday was a Holiday (${prev})`;
    } else {
      prevDayStrengthEl.textContent = `Previous Day's Strength (${prev}): ${getStrength(prev)}`;
    }
  }
}

function getMostRecentDate() {
  const dates = [...new Set(attendanceRecords.map(r => r.date))];
  return dates.sort().reverse()[0] || "";
}

function updateReportDateTime() {
  const dateEl = document.getElementById("date-time");
  if (dateEl) dateEl.textContent = new Date().toLocaleString();
}

async function initReportPage() {
  updateReportDateTime();
  setInterval(updateReportDateTime, 1000);
  try {
    const classesList = await getAll('classes');
    await setTeacherAndClassInfo(classesList);
    
    // Fetch everything once in parallel
    const [records, holidaysList, studentsList] = await Promise.all([
      getAll('attendance'),
      getAll('holidays'),
      getAll('students')
    ]);
    
    attendanceRecords = records;
    holidayDatesSet = new Set(holidaysList.map(h => h.date));
    reportStudents = studentsList;
    reportClasses = classesList;

    const dateFilterInput = document.getElementById("dateFilter");
    if (dateFilterInput) {
      const recentDate = getMostRecentDate();
      if (recentDate) {
        dateFilterInput.value = recentDate;
        renderAttendanceReport(recentDate);
      } else {
        renderAttendanceReport();
      }
      dateFilterInput.addEventListener("change", function () {
        renderAttendanceReport(this.value);
      });
    } else {
      renderAttendanceReport();
    }

    updateStrengthDisplays();
    renderAttendanceDoughnutChart();
    renderDailyLineChart();
  } catch (err) {
    console.error("Error initializing report page:", err);
  }
}


// ==========================================
// 7. Student Dashboard Module
// ==========================================

function updateStudentDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString();
  const dateTimeEl = document.getElementById("date-time");
  if (dateTimeEl) dateTimeEl.textContent = `${dateStr} | ${timeStr}`;
}

function initStudentLoginPage() {
  updateStudentDateTime();
  setInterval(updateStudentDateTime, 1000);

  const performSearch = async (studentId) => {
    const students = await getAll('students');
    const student = students.find(s => s.id === studentId || s.studentid === studentId);
    if (!student) return showAlert('Student not found.');

    const classId = student.classId || student.classid;
    const classIdEl = document.getElementById('class-id');
    if (classIdEl) classIdEl.textContent = classId;

    const records = await getAll('attendance');
    const myAttendance = records.filter(r => r.studentId === studentId || r.studentid === studentId);

    const attendanceByDate = {};
    for (const r of myAttendance) {
      if (!attendanceByDate[r.date] || r.markedByAdmin) {
        attendanceByDate[r.date] = r;
      }
    }

    const presents = Object.values(attendanceByDate).filter(r => r.status === 'Present').length;
    const absents = Object.values(attendanceByDate).filter(r => r.status === 'Absent').length;
    const total = presents + absents;
    const percentage = total > 0 ? ((presents / total) * 100).toFixed(1) + '%' : '0.0%';

    const detailsEl = document.getElementById('studentDetails');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <div class="card p-4 shadow-sm w-100 border-0 bg-light">
          <div class="row align-items-center text-center">
            <div class="col-md-4 mb-3 mb-md-0 text-md-start">
              <h5 class="text-primary mb-1">${student.name}</h5>
              <p class="text-muted mb-0">ID: ${studentId} | Class: ${classId}</p>
            </div>
            <div class="col-md-8">
              <div class="row g-2">
                <div class="col-4">
                  <div class="p-2 border rounded bg-white">
                    <div class="text-success fw-bold" style="font-size: 1.25rem;">${presents}</div>
                    <small class="text-muted text-uppercase" style="font-size: 0.75rem;">Presents</small>
                  </div>
                </div>
                <div class="col-4">
                  <div class="p-2 border rounded bg-white">
                    <div class="text-danger fw-bold" style="font-size: 1.25rem;">${absents}</div>
                    <small class="text-muted text-uppercase" style="font-size: 0.75rem;">Absents</small>
                  </div>
                </div>
                <div class="col-4">
                  <div class="p-2 border rounded bg-white">
                    <div class="text-info fw-bold" style="font-size: 1.25rem;">${percentage}</div>
                    <small class="text-muted text-uppercase" style="font-size: 0.75rem;">Attendance</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const calendarEvents = [];
    for (const date in attendanceByDate) {
      const record = attendanceByDate[date];
      let color = record.status === 'Present' ? '#198754' : (record.status === 'Absent' ? '#dc3545' : '#6c757d');
      calendarEvents.push({
        title: record.status,
        start: date,
        allDay: true,
        backgroundColor: color,
        borderColor: color
      });
    }

    const holidays = await getAll('holidays');
    for (const h of holidays) {
      calendarEvents.push({
        title: 'Holiday',
        start: h.date,
        allDay: true,
        backgroundColor: '#ffc107',
        borderColor: '#ffc107'
      });
    }

    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
      calendarEl.innerHTML = '';

      const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        height: 550,
        initialDate: myAttendance.length > 0 ? myAttendance[0].date : new Date().toISOString().split('T')[0],
        locale: 'en',
        themeSystem: 'bootstrap',
        selectable: true,
        events: calendarEvents,
        headerToolbar: {
          left: 'prev,next today',
          center: '',
          right: 'title'
        }
      });
      calendar.render();
    }
  };

  document.getElementById('searchBtn')?.addEventListener('click', async () => {
    const studentIdInput = document.getElementById('studentIdInput');
    if (!studentIdInput) return;
    const studentId = studentIdInput.value.trim();
    if (!studentId) return showAlert('Please enter your Student ID.');
    await performSearch(studentId);
  });

  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get('studentid') || localStorage.getItem('studentid');
  if (studentId) {
    const searchRow = document.getElementById('searchRow');
    if (searchRow) {
      searchRow.style.display = 'none';
    }
    const studentInput = document.getElementById('studentIdInput');
    if (studentInput) {
      studentInput.value = studentId;
    }
    performSearch(studentId);
  }
}


// ==========================================
// 8. Main DOM Initialization Router
// ==========================================
let confirmModal;

async function runRouterInit() {
  console.log("runRouterInit started, readyState:", document.readyState);
  
  // Seed database if empty before page init
  await seedDatabaseIfEmpty();

  // Test connection if badge exists
  if (document.getElementById('dbStatusBadge')) {
    testDatabaseConnection();
  }

  // Page Routing based on elements/pathname
  if (document.getElementById('loginForm')) {
    console.log("Routing to login page");
    initLoginPage();
  } else if (document.getElementById('classSummaryContainer')) {
    console.log("Routing to admin page");
    if (!checkAdminAuth()) return;
    initAdminPage();
  } else if (window.location.pathname.includes('teacherlogin.html')) {
    console.log("Routing to teacher dashboard");
    initTeacherLoginPage();
  } else if (document.getElementById('attendanceForm')) {
    console.log("Routing to mark attendance page");
    initAttendanceMarkPage();
  } else if (document.getElementById('attendanceReportTable')) {
    console.log("Routing to report page");
    initReportPage();
  } else if (document.getElementById('calendar')) {
    console.log("Routing to student login/calendar page");
    initStudentLoginPage();
  }
}

window.addEventListener("DOMContentLoaded", runRouterInit);
