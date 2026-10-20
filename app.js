// ==========================================================================
// Student Attendance System - High-Performance Real-Time Engine (app.js)
// ==========================================================================

// ==========================================
// 1. Shared Database, Auth & Alerts Module
// ==========================================

const DEFAULT_ADMIN_PASSWORD = "admin123";

function getAdminPassword() {
  return localStorage.getItem('adminPassword') || DEFAULT_ADMIN_PASSWORD;
}

function setAdminPassword(newPw) {
  localStorage.setItem('adminPassword', newPw);
}

// Default National / Academic Public Holidays
const DEFAULT_PUBLIC_HOLIDAYS = [
  { date: '2026-01-26', reason: 'Republic Day', classId: 'all', declaredBy: 'Academic Calendar' },
  { date: '2026-05-01', reason: 'Labor Day', classId: 'all', declaredBy: 'Academic Calendar' },
  { date: '2026-08-15', reason: 'Independence Day', classId: 'all', declaredBy: 'Academic Calendar' },
  { date: '2026-10-02', reason: 'Gandhi Jayanti', classId: 'all', declaredBy: 'Academic Calendar' },
  { date: '2026-12-25', reason: 'Christmas Day', classId: 'all', declaredBy: 'Academic Calendar' },
  { date: '2026-01-01', reason: "New Year's Day", classId: 'all', declaredBy: 'Academic Calendar' }
];

// Helper to check if a date is Sunday (Weekly Off)
function isDateSunday(dateInput) {
  if (!dateInput) return false;
  if (dateInput instanceof Date) {
    return dateInput.getDay() === 0;
  }
  const dateStr = String(dateInput).slice(0, 10);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d, 12, 0, 0);
    return dt.getDay() === 0;
  }
  const dt = new Date(dateStr);
  return dt.getDay() === 0;
}

// Helper to check if a date is Saturday (Explicitly regular working day)
function isDateSaturday(dateInput) {
  if (!dateInput) return false;
  if (dateInput instanceof Date) {
    return dateInput.getDay() === 6;
  }
  const dateStr = String(dateInput).slice(0, 10);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d, 12, 0, 0);
    return dt.getDay() === 6;
  }
  const dt = new Date(dateStr);
  return dt.getDay() === 6;
}

// Check if a date is a holiday (Sunday, Public Holiday, or Declared Class Holiday)
async function isDateHoliday(dateStr, classId) {
  if (isDateSunday(dateStr)) {
    return { isHoliday: true, reason: 'Sunday - Weekly Off' };
  }
  const holidays = await getAll('holidays');
  const match = holidays.find(h =>
    h.date === dateStr &&
    (h.classId === 'all' || !h.classId || h.classId === classId)
  );
  if (match) {
    return { isHoliday: true, reason: match.reason || 'Academic Holiday' };
  }
  return { isHoliday: false, reason: '' };
}

async function seedDatabaseIfEmpty() {
  const classes = await getAll('classes');
  if (classes.length === 0) {
    console.log("Seeding initial academic data...");
    await save('classes', { id: 'C101', name: 'Mathematics & Computing' });
    await save('classes', { id: 'C102', name: 'Applied Sciences & Physics' });

    await save('teachers', { id: 'T101', name: 'Sarah Connor', contact: '1234567890', subject: 'Mathematics', password: 'password' });
    await save('teachers', { id: 'T102', name: 'John Doe', contact: '9876543210', subject: 'Science', password: 'password' });

    await save('students', { id: 'S101', name: 'Alice Smith', classId: 'C101', contact: '1112223333', gender: 'Female' });
    await save('students', { id: 'S102', name: 'Bob Jones', classId: 'C101', contact: '4445556666', gender: 'Male' });
    await save('students', { id: 'S103', name: 'Charlie Brown', classId: 'C102', contact: '7778889999', gender: 'Male' });
    await save('students', { id: 'S104', name: 'Diana Prince', classId: 'C102', contact: '2223334444', gender: 'Female' });

    // Seed default public holidays
    for (const h of DEFAULT_PUBLIC_HOLIDAYS) {
      await save('holidays', h);
    }

    // Seed recent attendance logs for past working days
    const today = new Date();
    let daysBack = 1;
    let seededDays = 0;
    while (seededDays < 6 && daysBack < 14) {
      const pastDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack, 12, 0, 0);
      const dateStr = formatDate(pastDate);

      // Skip Sundays when seeding attendance (Saturdays are regular working academic days)
      if (!isDateSunday(dateStr)) {
        await save('attendance', { classId: 'C101', studentId: 'S101', date: dateStr, status: Math.random() > 0.15 ? 'Present' : 'Absent', markedByAdmin: false });
        await save('attendance', { classId: 'C101', studentId: 'S102', date: dateStr, status: Math.random() > 0.25 ? 'Present' : 'Absent', markedByAdmin: false });
        await save('attendance', { classId: 'C102', studentId: 'S103', date: dateStr, status: Math.random() > 0.2 ? 'Present' : 'Absent', markedByAdmin: false });
        await save('attendance', { classId: 'C102', studentId: 'S104', date: dateStr, status: Math.random() > 0.1 ? 'Present' : 'Absent', markedByAdmin: false });
        seededDays++;
      }
      daysBack++;
    }

    await addLog({
      type: 'System',
      message: 'System database initialized with academic records, default Sundays & public holidays',
      date: formatDate(today)
    });
    console.log("Database seeding completed.");
  }
}

function handleLogout(e) {
  if (e) e.preventDefault();
  localStorage.removeItem('teacherid');
  localStorage.removeItem('classid');
  localStorage.removeItem('studentid');
  localStorage.removeItem('isAdmin');
  showAlert("Logged out successfully. See you soon!", "info");
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 400);
}
window.handleLogout = handleLogout;

function goToReport() {
  const teacherId = localStorage.getItem('teacherid') || getQueryParam('teacherid');
  const classId = localStorage.getItem('classid') || getQueryParam('classid');
  if (!teacherId || !classId) {
    showAlert("Missing faculty or class context.", "warning");
    return;
  }
  window.location.href = `report.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
}
window.goToReport = goToReport;

function checkAdminAuth() {
  if (localStorage.getItem('isAdmin') !== 'true') {
    showAlert("Restricted Access: Super Admin credentials required.", "danger");
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// Modern High-Performance Toast Notification System
window.showAlert = function (msg, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const iconMap = {
    success: 'bi-check-circle-fill text-success',
    danger: 'bi-exclamation-octagon-fill text-danger',
    warning: 'bi-exclamation-triangle-fill text-warning',
    info: 'bi-info-circle-fill text-info'
  };

  const iconClass = iconMap[type] || iconMap.info;

  const toast = document.createElement('div');
  toast.className = `custom-toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi ${iconClass} toast-icon"></i>
    <div class="toast-text">${msg}</div>
    <button type="button" class="toast-close" title="Dismiss">&times;</button>
  `;

  toast.querySelector('.toast-close').onclick = () => toast.remove();
  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }
  }, 3500);
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
    const statusText = document.getElementById('dbStatusText');
    if (badge && val === 'test_val') {
      if (statusText) statusText.textContent = 'Real-Time Sync Active';
    }
  } catch (e) {
    const badge = document.getElementById('dbStatusBadge');
    if (badge) {
      badge.innerHTML = '<span class="status-dot" style="background:#ef4444;box-shadow:0 0 8px #ef4444;"></span><span>Sync Offline</span>';
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
        console.error("Error parsing store: " + store + " during save.", parseErr);
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

function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') return date.slice(0, 10);
  const dt = (date instanceof Date) ? date : new Date(date);
  if (isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function addLog({ type, message, date = formatDate(new Date()), classId = '', details = {} }) {
  await save('logs', {
    type,
    message,
    date,
    classId,
    timestamp: new Date().toLocaleTimeString(),
    ...details
  });
}

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}


// ==========================================
// 2. Login Page Module (With Alt+A Secret Admin)
// ==========================================

function handleAdminLogin(enteredPassword) {
  const targetPassword = getAdminPassword();
  const password = enteredPassword !== undefined ? enteredPassword : prompt("Enter Admin Password:");

  if (password === targetPassword) {
    localStorage.setItem('isAdmin', 'true');
    showAlert("Admin authentication verified! Redirecting to Console...", "success");
    setTimeout(() => {
      window.location.href = "admin.html";
    }, 500);
    return true;
  } else if (password !== null && password !== "") {
    showAlert("Incorrect Admin Password! (Default is admin123)", "danger");
    return false;
  }
}
window.handleAdminLogin = handleAdminLogin;

function submitModalAdminLogin() {
  const pw = document.getElementById('modalAdminPasswordInput')?.value;
  if (!pw) return showAlert("Please enter the Admin Password.", "warning");
  const success = handleAdminLogin(pw);
  if (success) {
    const modalEl = document.getElementById('adminLoginModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  }
}
window.submitModalAdminLogin = submitModalAdminLogin;

// Role selector for Teacher & Student
let currentRole = 'teacher';

function selectLoginRole(role) {
  currentRole = role;

  document.querySelectorAll('.role-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-role') === role) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const studentGroup = document.getElementById('studentIdGroup');
  const teacherGroup = document.getElementById('teacherIdGroup');
  const classGroup = document.getElementById('classIdGroup');
  const passwordGroup = document.getElementById('passwordGroup');
  const loginBtnText = document.getElementById('loginBtnText');

  if (role === 'student') {
    if (studentGroup) studentGroup.style.display = 'block';
    if (teacherGroup) teacherGroup.style.display = 'none';
    if (classGroup) classGroup.style.display = 'block';
    if (passwordGroup) passwordGroup.style.display = 'none';
    if (loginBtnText) loginBtnText.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Access Student Portal';
  } else {
    // Teacher
    if (studentGroup) studentGroup.style.display = 'none';
    if (teacherGroup) teacherGroup.style.display = 'block';
    if (classGroup) classGroup.style.display = 'block';
    if (passwordGroup) passwordGroup.style.display = 'block';
    if (loginBtnText) loginBtnText.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Login as Teacher';
  }
}
window.selectLoginRole = selectLoginRole;

// Quick Fill Demo helper
function quickFillDemo(role) {
  selectLoginRole(role);
  if (role === 'teacher') {
    const tInput = document.getElementById('teacherid');
    const cInput = document.getElementById('classid');
    const pInput = document.getElementById('password');
    if (tInput) tInput.value = 'T101';
    if (cInput) cInput.value = 'C101';
    if (pInput) pInput.value = 'password';
    showAlert("Teacher demo credentials filled (T101 / password)", "info");
  } else if (role === 'student') {
    const sInput = document.getElementById('studentid');
    const cInput = document.getElementById('classid');
    if (sInput) sInput.value = 'S101';
    if (cInput) cInput.value = 'C101';
    showAlert("Student demo credentials filled (S101)", "info");
  }
}
window.quickFillDemo = quickFillDemo;

// Show/Hide password toggle
function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  const icon = btnEl.querySelector('i');
  if (icon) {
    icon.className = isPw ? 'bi bi-eye-slash' : 'bi bi-eye';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

async function loadClasses() {
  try {
    const classSelect = document.getElementById('classid');
    if (!classSelect) return;
    const classes = await getAll('classes');
    classSelect.innerHTML = '<option value="" disabled selected>-- Select Assigned Class --</option>';
    classes.forEach(cls => {
      const option = document.createElement('option');
      option.value = cls.id;
      option.textContent = `${cls.name || cls.id} (${cls.id})`;
      classSelect.appendChild(option);
    });
  } catch (e) {
    console.error("Exception in loadClasses:", e);
  }
}

function initLoginPage() {
  loadClasses();
  testDatabaseConnection();

  // Role Tab listeners
  document.querySelectorAll('.role-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectLoginRole(btn.getAttribute('data-role'));
    });
  });

  // Alt+A Secret Code to reveal Admin Login Section
  document.addEventListener('keydown', function (event) {
    if (event.altKey && (event.key === 'a' || event.key === 'A')) {
      const adminArea = document.getElementById('adminSecretArea');
      if (adminArea) {
        const isHidden = adminArea.style.display === 'none' || !adminArea.style.display;
        adminArea.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          showAlert("Secret Admin Portal Unlocked (Alt+A)", "info");
        }
      }
    }
  });

  // Default to teacher
  selectLoginRole('teacher');

  // Login Form Submission
  document.getElementById('loginForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const classId = document.getElementById('classid')?.value;
    if (!classId) {
      return showAlert('Please select an assigned class.', "warning");
    }

    if (currentRole === 'teacher') {
      const teacherId = document.getElementById('teacherid')?.value.trim();
      const password = document.getElementById('password')?.value;

      if (!teacherId || !password) return showAlert('Please fill all teacher credentials.', "warning");

      const teachers = await getAll('teachers');
      const teacher = teachers.find(t => t.id === teacherId && t.password === password);

      if (teacher) {
        localStorage.setItem('teacherid', teacherId);
        localStorage.setItem('classid', classId);
        showAlert(`Welcome, Professor ${teacher.name}!`, "success");
        setTimeout(() => {
          window.location.href = `teacherlogin.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
        }, 500);
      } else {
        showAlert('Invalid Faculty ID or Password.', "danger");
      }
    } else {
      // Student
      const studentId = document.getElementById('studentid')?.value.trim();
      if (!studentId) return showAlert('Please enter your Student ID.', "warning");

      const students = await getAll('students');
      const student = students.find(s => s.id === studentId && s.classId === classId);

      if (student) {
        localStorage.setItem('studentid', studentId);
        showAlert(`Welcome, ${student.name}!`, "success");
        setTimeout(() => {
          window.location.href = `studentlogin.html?studentid=${encodeURIComponent(studentId)}`;
        }, 500);
      } else {
        showAlert(`Student "${studentId}" not enrolled in this class.`, "danger");
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
        className: cls.name || classId,
        totalStudents: 0,
        totalPresent: 0,
        averageAttendancePercentage: null,
        status: 'No Students'
      });
      return;
    }
    const attendanceForDate = attendanceRecordsAll.filter(r =>
      ((r.classId === classId || r.classid === classId) && r.date === date)
    );

    if (attendanceForDate.length === 0) {
      results.push({
        classId,
        className: cls.name || classId,
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
      className: cls.name || classId,
      totalStudents,
      totalPresent: presentCount,
      averageAttendancePercentage: Math.round(avgAttendancePercent * 100) / 100,
      status: 'Recorded'
    });
  });
  return results;
}

function renderClassAttendanceSummary(date) {
  const container = document.getElementById('classAttendanceSummary');
  if (!container) return;

  const summary = calculateClassAttendanceSummary(classes, students, attendanceRecordsAll, date);

  if (!summary.length) {
    container.innerHTML = `<div class="text-center py-4 text-muted">No academic classes registered yet.</div>`;
    return;
  }

  let html = `
  <div class="table-responsive">
    <table class="table table-bordered table-hover align-middle text-center mb-0">
      <thead>
        <tr>
          <th>Class Name & Code</th>
          <th>Total Students</th>
          <th>Present Students</th>
          <th>Attendance Rate</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>`;

  summary.forEach(row => {
    let rateDisplay = '--';
    let badgeClass = 'bg-secondary';
    let progressColor = 'var(--primary)';

    if (row.averageAttendancePercentage !== null) {
      rateDisplay = row.averageAttendancePercentage.toFixed(1) + "%";
      if (row.averageAttendancePercentage >= 75) {
        badgeClass = 'bg-success';
        progressColor = 'var(--success)';
      } else if (row.averageAttendancePercentage >= 50) {
        badgeClass = 'bg-warning text-dark';
        progressColor = 'var(--warning)';
      } else {
        badgeClass = 'bg-danger';
        progressColor = 'var(--danger)';
      }
    }

    html += `
      <tr>
        <td class="text-start ps-3">
          <strong>${row.className}</strong>
          <div class="text-muted small">Code: ${row.classId}</div>
        </td>
        <td><strong>${row.totalStudents}</strong></td>
        <td><strong class="text-success">${row.totalPresent}</strong></td>
        <td>
          <div class="d-flex align-items-center justify-content-center gap-2">
            <span class="badge ${badgeClass}">${rateDisplay}</span>
            <div class="progress d-none d-md-flex" style="width: 70px; height: 6px;">
              <div class="progress-bar" style="width: ${row.averageAttendancePercentage || 0}%; background: ${progressColor};"></div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge ${row.status === 'Recorded' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-light text-muted border'}">
            ${row.status}
          </span>
        </td>
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

  // Update Top KPIs
  const totalClassesEl = document.getElementById("totalClasses");
  if (totalClassesEl) totalClassesEl.textContent = classes.length;

  const totalStudentsEl = document.getElementById("totalStudentsCount");
  if (totalStudentsEl) totalStudentsEl.textContent = students.length;

  const totalTeachersEl = document.getElementById("totalTeachersCount");
  if (totalTeachersEl) totalTeachersEl.textContent = teachers.length;

  const totalHolidaysEl = document.getElementById("totalHolidays");
  if (totalHolidaysEl) totalHolidaysEl.textContent = holidays.length;

  renderClasses();
  renderStudentTable();
  renderTeacherTable();
  renderHolidays();
  renderLogs();
  populateClassDropdowns();

  const summaryDateInput = document.getElementById('adminSummaryDateFilter');
  if (summaryDateInput && !summaryDateInput.value) {
    summaryDateInput.value = formatDate(new Date());
  }

  const date = summaryDateInput?.value || formatDate(new Date());
  renderClassAttendanceSummary(date);

  const dateInput = document.getElementById('attendanceDateFilter');
  if (dateInput && !dateInput.value) {
    dateInput.value = formatDate(new Date());
  }
  renderAttendanceTable();
}

function renderClasses() {
  const container = document.getElementById("classSummaryContainer");
  if (container) {
    let containerHTML = "";
    if (classes.length === 0) {
      containerHTML = `<div class="col-12 text-center py-4 text-muted">No classes created yet. Click "Classes" above to add one.</div>`;
    } else {
      classes.forEach(cls => {
        const studentsCount = students.filter(st => st.classId === cls.id).length;
        const classTeacher = teachers.find(
          t => t.subject && cls.name && cls.name.includes(t.subject)
        )?.name || "Faculty Assigned";

        containerHTML += `
        <div class="col-md-4">
          <div class="card p-3 h-100">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="fw-bold mb-0 text-primary">${cls.name || cls.id}</h6>
              <span class="badge bg-light text-muted border">${cls.id}</span>
            </div>
            <div class="small text-muted mb-2"><i class="bi bi-person-workspace text-secondary"></i> Faculty: <strong>${classTeacher}</strong></div>
            <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
              <span class="small text-muted">Enrolled Scholars:</span>
              <span class="badge bg-primary rounded-pill px-2 py-1">${studentsCount}</span>
            </div>
          </div>
        </div>`;
      });
    }
    container.innerHTML = containerHTML;
  }

  const classList = document.getElementById("classList");
  if (classList) {
    let classListHTML = "";
    classes.forEach((cls) => {
      const studentsCount = students.filter(st => st.classId === cls.id).length;
      classListHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
        <div><strong>${cls.id}</strong> - ${cls.name || ""}<span class="ms-2 badge bg-light text-muted border">${studentsCount} Scholars</span></div>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary" onclick="editClass('${cls.id}')" title="Edit Class"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteClass('${cls.id}')" title="Delete Class"><i class="bi bi-trash"></i></button>
        </div>
      </li>`;
    });
    classList.innerHTML = classListHTML;
  }
}

// Edit Class Functions
function editClass(id) {
  const cls = classes.find(c => c.id === id);
  if (!cls) return showAlert("Class record not found.", "warning");
  document.getElementById('editClassOriginalID').value = cls.id;
  document.getElementById('editClassIDInput').value = cls.id;
  document.getElementById('editClassNameInput').value = cls.name || "";
  const modal = new bootstrap.Modal(document.getElementById('editClassModal'));
  modal.show();
}
window.editClass = editClass;

async function saveClassEdit() {
  const oldId = document.getElementById('editClassOriginalID').value;
  const newId = document.getElementById('editClassIDInput').value.trim();
  const newName = document.getElementById('editClassNameInput').value.trim();

  if (!newId || !newName) {
    return showAlert("Please provide both Class ID and Class Name.", "warning");
  }

  if (newId !== oldId && classes.some(c => c.id === newId)) {
    return showAlert(`Class ID "${newId}" already exists.`, "danger");
  }

  // If ID changed, update all students enrolled in oldId
  if (newId !== oldId) {
    await remove('classes', oldId);
    for (const student of students) {
      if (student.classId === oldId) {
        student.classId = newId;
        await save('students', student);
      }
    }
  }

  await save('classes', { id: newId, name: newName });
  await addLog({
    type: 'Class',
    message: `Admin modified class details: "${newName}" (${newId})`,
    classId: newId
  });

  showAlert(`Class "${newName}" updated successfully.`, "success");
  bootstrap.Modal.getOrCreateInstance(document.getElementById('editClassModal')).hide();
  await loadAllAdminData();
}
window.saveClassEdit = saveClassEdit;

function renderStudentTable() {
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;
  const filterClass = document.getElementById("studentClassFilter")?.value;
  let filteredStudents = filterClass ? students.filter(s => s.classId === filterClass) : students;
  tbody.innerHTML = "";
  if (!filteredStudents.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No scholars match the selection.</td></tr>`;
    return;
  }
  let tableHTML = "";
  filteredStudents.forEach(stu => {
    tableHTML += `<tr data-id="${stu.id}">
      <td><strong>${stu.id}</strong></td>
      <td>${stu.name}</td>
      <td><span class="badge bg-light text-primary border">${stu.classId}</span></td>
      <td>${stu.contact || "--"}</td>
      <td><span class="badge ${stu.gender === 'Female' ? 'bg-pink-subtle text-danger' : 'bg-info-subtle text-info'}">${stu.gender || "Unspecified"}</span></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary" onclick="editStudent('${stu.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${stu.id}')"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`;
  });
  tbody.innerHTML = tableHTML;
}

function filterStudentTableLive() {
  const query = document.getElementById('searchStudentInput')?.value.toLowerCase().trim();
  const rows = document.querySelectorAll('#studentTableBody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}
window.filterStudentTableLive = filterStudentTableLive;

function renderTeacherTable() {
  const tbody = document.getElementById("teacherTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!teachers.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No faculty members found.</td></tr>`;
    return;
  }
  let tableHTML = "";
  teachers.forEach(t => {
    tableHTML += `<tr>
      <td><strong>${t.id}</strong></td>
      <td>${t.name}</td>
      <td>${t.contact || "--"}</td>
      <td><span class="badge bg-secondary-subtle text-secondary border">${t.subject || "General"}</span></td>
      <td><code>••••••••</code></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary" onclick="editTeacher('${t.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteTeacher('${t.id}')"><i class="bi bi-trash"></i></button>
        </div>
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
    if (holidays.length === 0) {
      holidayList.innerHTML = `<li class="list-group-item text-center text-muted">No holidays declared.</li>`;
      return;
    }
    holidayList.innerHTML = holidays.map(h => {
      const scopeBadge = h.classId === 'all' || !h.classId
        ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle ms-2">All Classes</span>`
        : `<span class="badge bg-info-subtle text-info border border-info-subtle ms-2">Class ${h.classId}</span>`;

      return `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <div>
          <strong class="text-danger">${h.date}</strong> - ${h.reason}
          ${scopeBadge}
          <div class="small text-muted">Declared by: ${h.declaredBy || 'Admin'}</div>
        </div>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteHoliday('${h.date}')"><i class="bi bi-trash"></i></button>
      </li>`;
    }).join('');
  }
}

function renderLogs() {
  const logList = document.getElementById("logList");
  if (!logList) return;
  if (!logs.length) {
    logList.innerHTML = `<li class="list-group-item text-center text-muted">No activity logs recorded yet.</li>`;
    return;
  }
  logList.innerHTML = logs.slice().reverse().map(log =>
    `<li class="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <span class="badge bg-primary-subtle text-primary border border-primary-subtle me-2">${log.type || 'Event'}</span>
        <span>${log.message}</span>
      </div>
      <small class="text-muted font-monospace">${log.date} ${log.timestamp || ''}</small>
    </li>`
  ).join('');
}

function populateClassDropdowns() {
  const studentClassFilter = document.getElementById("studentClassFilter");
  if (studentClassFilter) {
    const val = studentClassFilter.value;
    studentClassFilter.innerHTML = `<option value="">All Classes</option>` +
      classes.map(c => `<option value="${c.id}"${val === c.id ? " selected" : ""}>${c.name || c.id} (${c.id})</option>`).join('');
  }
  const newStudentClass = document.getElementById("newStudentClass");
  if (newStudentClass) {
    newStudentClass.innerHTML = `<option value="">Select Class</option>` +
      classes.map(c => `<option value="${c.id}">${c.name || c.id} (${c.id})</option>`).join('');
  }
  const attendanceClassFilter = document.getElementById('attendanceClassFilter');
  if (attendanceClassFilter) {
    const val = attendanceClassFilter.value;
    attendanceClassFilter.innerHTML = `<option value="">All Classes</option>` +
      classes.map(c => `<option value="${c.id}"${val === c.id ? " selected" : ""}>${c.name || c.id} (${c.id})</option>`).join('');
  }
  const holidayScopeSelect = document.getElementById('holidayScopeSelect');
  if (holidayScopeSelect) {
    holidayScopeSelect.innerHTML = `<option value="all">All Classes (Institute-Wide)</option>` +
      classes.map(c => `<option value="${c.id}">Specific Class: ${c.name || c.id} (${c.id})</option>`).join('');
  }
}

function confirmAction(message, onConfirm) {
  if (window.confirm(message)) {
    onConfirm();
  }
}

async function addClass() {
  const id = document.getElementById("newClassInput")?.value.trim();
  const name = document.getElementById("newClassNameInput")?.value.trim();
  if (!id || !name) return showAlert("Please enter both Class ID and Class Name.", "warning");
  if (classes.some(cls => cls.id === id)) return showAlert(`Class ID "${id}" already exists.`, "danger");

  await save('classes', { id, name });
  await addLog({ type: 'Class', message: `Added class "${name}" (${id})`, classId: id });
  document.getElementById("newClassInput").value = "";
  document.getElementById("newClassNameInput").value = "";
  showAlert(`Class "${name}" added successfully.`, "success");
  await loadAllAdminData();
}

async function deleteClass(id) {
  confirmAction(`Are you sure you want to delete class ${id}?`, async () => {
    await remove('classes', id);
    await addLog({ type: 'Class', message: `Deleted class "${id}"`, classId: id });
    showAlert(`Class ${id} deleted.`, "info");
    await loadAllAdminData();
  });
}

async function addStudent() {
  const id = document.getElementById("newStudentID")?.value.trim();
  const name = document.getElementById("newStudentName")?.value.trim();
  const classId = document.getElementById("newStudentClass")?.value;
  const contact = document.getElementById("newStudentContact")?.value.trim();
  const gender = document.getElementById("newStudentGender")?.value;
  if (![id, name, classId, contact, gender].every(Boolean)) return showAlert("Please fill all student fields.", "warning");
  if (students.some(s => s.id === id)) return showAlert(`Student ID "${id}" already exists.`, "danger");

  await save('students', { id, name, classId, contact, gender });
  await addLog({ type: 'Student', message: `Enrolled student "${name}" (${id}) in Class ${classId}`, classId });
  ["newStudentID", "newStudentName", "newStudentClass", "newStudentContact", "newStudentGender"].forEach(idBox => {
    const el = document.getElementById(idBox); if (el) el.value = "";
  });
  showAlert(`Student "${name}" registered successfully.`, "success");
  await loadAllAdminData();
}

async function deleteStudent(id) {
  confirmAction(`Are you sure you want to delete student ${id}?`, async () => {
    await remove('students', id);
    await addLog({ type: 'Student', message: `Deleted student record ID "${id}"` });
    showAlert(`Student ${id} removed.`, "info");
    await loadAllAdminData();
  });
}

async function addTeacher() {
  const id = document.getElementById("newTeacherID")?.value.trim();
  const name = document.getElementById("newTeacherName")?.value.trim();
  const contact = document.getElementById("newTeacherContact")?.value.trim();
  const subject = document.getElementById("newTeacherSubject")?.value.trim();
  const password = document.getElementById("newTeacherPassword")?.value.trim();
  if (![id, name, contact, subject, password].every(Boolean)) return showAlert("Please fill all faculty fields.", "warning");
  if (teachers.some(t => t.id === id)) return showAlert(`Faculty ID "${id}" already exists.`, "danger");

  await save('teachers', { id, name, contact, subject, password });
  await addLog({ type: 'Faculty', message: `Registered faculty member "${name}" (${id}) for ${subject}` });
  ["newTeacherID", "newTeacherName", "newTeacherContact", "newTeacherSubject", "newTeacherPassword"].forEach(fld => {
    const el = document.getElementById(fld); if (el) el.value = "";
  });
  showAlert(`Faculty "${name}" added successfully.`, "success");
  await loadAllAdminData();
}

async function deleteTeacher(id) {
  confirmAction(`Are you sure you want to delete faculty member ${id}?`, async () => {
    await remove('teachers', id);
    await addLog({ type: 'Faculty', message: `Deleted faculty record ID "${id}"` });
    showAlert(`Faculty ${id} removed.`, "info");
    await loadAllAdminData();
  });
}

// Add Holiday with Scope (all classes vs specific class)
async function addHoliday() {
  const date = document.getElementById("holidayDateInput")?.value;
  const reason = document.getElementById("holidayReasonInput")?.value.trim();
  const scope = document.getElementById("holidayScopeSelect")?.value || 'all';

  if (!date || !reason) return showAlert("Please fill both holiday date and description.", "warning");
  if (holidays.some(h => h.date === date && (h.classId === scope || scope === 'all'))) {
    return showAlert(`Holiday on "${date}" already declared for this scope.`, "danger");
  }

  await save('holidays', {
    date,
    reason,
    classId: scope,
    declaredBy: 'Administrator'
  });

  const scopeText = scope === 'all' ? 'All Classes' : `Class ${scope}`;
  await addLog({ type: 'Holiday', message: `Admin declared holiday "${reason}" on ${date} for ${scopeText}`, date, classId: scope });
  document.getElementById("holidayDateInput").value = "";
  document.getElementById("holidayReasonInput").value = "";
  showAlert(`Holiday on ${date} saved for ${scopeText}.`, "success");
  await loadAllAdminData();
}

async function deleteHoliday(date) {
  confirmAction(`Are you sure you want to delete holiday on ${date}?`, async () => {
    await remove('holidays', date);
    await addLog({ type: 'Holiday', message: `Removed holiday declared on ${date}`, date });
    showAlert(`Holiday on ${date} removed.`, "info");
    await loadAllAdminData();
  });
}

function renderAttendanceTable() {
  const attendanceClassFilter = document.getElementById('attendanceClassFilter');
  const classId = attendanceClassFilter ? attendanceClassFilter.value : "";
  const dateInput = document.getElementById('attendanceDateFilter');
  const date = dateInput ? dateInput.value : "";
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody || !date) return;

  let studentsToRender = students;
  if (classId) {
    studentsToRender = students.filter(s => s.classId === classId);
  }

  if (!studentsToRender.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No enrolled scholars in this selection.</td></tr>`;
    return;
  }

  const attendanceForDate = attendanceRecordsAll.filter(r => r.date === date);
  let tableHTML = "";
  studentsToRender.forEach(student => {
    const adminRecord = attendanceForDate.find(r => r.studentId === student.id && r.markedByAdmin === true);
    const teacherRecord = attendanceForDate.find(r => r.studentId === student.id && !r.markedByAdmin);
    const currentStatus = adminRecord ? adminRecord.status : (teacherRecord ? teacherRecord.status : "Not marked");
    const markedBy = adminRecord ? 'Super Admin' : (teacherRecord ? 'Faculty' : 'Pending');

    tableHTML += `<tr>
      <td>${date}</td>
      <td><strong>${student.id}</strong></td>
      <td>${student.name}</td>
      <td><span class="badge bg-light text-muted border">${student.classId}</span></td>
      <td>
        <span class="badge ${currentStatus === 'Present' ? 'bg-success' : (currentStatus === 'Absent' ? 'bg-danger' : 'bg-secondary')}">
          ${currentStatus}
        </span>
      </td>
      <td><small class="text-muted">${markedBy}</small></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm ${currentStatus === 'Present' ? 'btn-success' : 'btn-outline-success'}" onclick="setAttendanceOverride('${student.id}', '${student.classId}', '${date}', 'Present')">Present</button>
          <button class="btn btn-sm ${currentStatus === 'Absent' ? 'btn-danger' : 'btn-outline-danger'}" onclick="setAttendanceOverride('${student.id}', '${student.classId}', '${date}', 'Absent')">Absent</button>
        </div>
      </td>
    </tr>`;
  });
  tbody.innerHTML = tableHTML;
}

async function setAttendanceOverride(studentId, classId, date, status) {
  const record = {
    classId,
    studentId,
    date,
    status,
    markedByAdmin: true
  };
  await save('attendance', record);
  await addLog({
    type: 'Admin Override',
    message: `Admin set status of student ${studentId} to "${status}" for ${date}`,
    classId,
    date
  });
  attendanceRecordsAll = await getAll('attendance');
  renderAttendanceTable();
  renderClassAttendanceSummary(date);
  showAlert(`Status updated to ${status}.`, "success");
}
window.setAttendanceOverride = setAttendanceOverride;

function populateEditStudentClassDropdown(selectedId) {
  const select = document.getElementById("editStudentClass");
  if (!select) return;
  select.innerHTML = classes.map(c =>
    `<option value="${c.id}"${c.id === selectedId ? " selected" : ""}>${c.id} - ${c.name || ""}</option>`
  ).join('');
}

function editStudent(id) {
  const student = students.find(s => s.id === id);
  if (!student) return showAlert("Student not found.", "danger");
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
  if (!teacher) return showAlert("Faculty member not found.", "danger");
  document.getElementById("editTeacherID").value = teacher.id;
  document.getElementById("editTeacherName").value = teacher.name;
  document.getElementById("editTeacherContact").value = teacher.contact || "";
  document.getElementById("editTeacherSubject").value = teacher.subject || "";
  document.getElementById("editTeacherPassword").value = teacher.password || "";
  const modal = new bootstrap.Modal(document.getElementById("editTeacherModal"));
  modal.show();
}

// Admin Password & Settings Modal Handler
function updateAdminPasswordFromModal() {
  const curPw = document.getElementById('currentAdminPasswordInput')?.value;
  const newPw = document.getElementById('newAdminPasswordInput')?.value;
  const confirmPw = document.getElementById('confirmAdminPasswordInput')?.value;

  if (!curPw || !newPw || !confirmPw) {
    return showAlert("Please fill in all password fields.", "warning");
  }

  if (curPw !== getAdminPassword()) {
    return showAlert("Current password does not match.", "danger");
  }

  if (newPw.length < 4) {
    return showAlert("New password must be at least 4 characters long.", "warning");
  }

  if (newPw !== confirmPw) {
    return showAlert("New password and confirmation do not match.", "danger");
  }

  setAdminPassword(newPw);
  addLog({ type: 'Security', message: 'Administrator security password was updated successfully.' });
  showAlert("Admin password updated successfully!", "success");

  document.getElementById('currentAdminPasswordInput').value = '';
  document.getElementById('newAdminPasswordInput').value = '';
  document.getElementById('confirmAdminPasswordInput').value = '';

  const modalEl = document.getElementById('adminSettingsModal');
  if (modalEl) {
    bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  }
}
window.updateAdminPasswordFromModal = updateAdminPasswordFromModal;

// Reset Demo Data helper
async function resetDatabaseToDefault() {
  if (confirm("Reset database to initial demo sample records? This will restore clean test data.")) {
    localStorage.removeItem('attendanceDB_classes');
    localStorage.removeItem('attendanceDB_students');
    localStorage.removeItem('attendanceDB_teachers');
    localStorage.removeItem('attendanceDB_holidays');
    localStorage.removeItem('attendanceDB_attendance');
    localStorage.removeItem('attendanceDB_logs');
    setAdminPassword(DEFAULT_ADMIN_PASSWORD);
    await seedDatabaseIfEmpty();
    await loadAllAdminData();
    showAlert("Database refreshed with clean demo data. Admin password reset to admin123.", "success");
    const modalEl = document.getElementById('adminSettingsModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  }
}
window.resetDatabaseToDefault = resetDatabaseToDefault;

// Export data functions
function exportStudentsToCSV() {
  if (!students.length) return showAlert("No students to export.", "warning");
  let csv = "Student ID,Name,Class ID,Contact,Gender\n";
  students.forEach(s => {
    csv += `"${s.id}","${s.name}","${s.classId}","${s.contact || ''}","${s.gender || ''}"\n`;
  });
  downloadCSV(csv, "students_roster.csv");
  showAlert("Students roster exported to CSV.", "success");
}
window.exportStudentsToCSV = exportStudentsToCSV;

function exportAttendanceLogsToCSV() {
  if (!logs.length) return showAlert("No audit logs to export.", "warning");
  let csv = "Log ID,Type,Message,Class ID,Date,Timestamp\n";
  logs.forEach(l => {
    csv += `"${l._id || ''}","${l.type || ''}","${(l.message || '').replace(/"/g, '""')}","${l.classId || ''}","${l.date || ''}","${l.timestamp || ''}"\n`;
  });
  downloadCSV(csv, "attendance_system_audit_logs.csv");
  showAlert("System audit logs exported to CSV.", "success");
}
window.exportAttendanceLogsToCSV = exportAttendanceLogsToCSV;

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  document.getElementById("saveEditStudentBtn")?.addEventListener("click", async function () {
    const id = document.getElementById("editStudentID").value;
    const name = document.getElementById("editStudentName").value.trim();
    const classId = document.getElementById("editStudentClass").value;
    const contact = document.getElementById("editStudentContact").value.trim();
    const gender = document.getElementById("editStudentGender").value;
    if (![id, name, classId, contact, gender].every(Boolean)) return showAlert("Please fill all fields.", "warning");
    await save('students', { id, name, classId, contact, gender });
    await addLog({ type: 'Student', message: `Edited student "${name}" (${id})`, classId });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("editStudentModal")).hide();
    showAlert(`Student ${name} updated.`, "success");
    await loadAllAdminData();
  });

  document.getElementById("saveEditTeacherBtn")?.addEventListener("click", async function () {
    const id = document.getElementById("editTeacherID").value;
    const name = document.getElementById("editTeacherName").value.trim();
    const contact = document.getElementById("editTeacherContact").value.trim();
    const subject = document.getElementById("editTeacherSubject").value.trim();
    const password = document.getElementById("editTeacherPassword").value.trim();
    if (![id, name, contact, subject, password].every(Boolean)) return showAlert("Please fill all fields.", "warning");
    await save('teachers', { id, name, contact, subject, password });
    await addLog({ type: 'Faculty', message: `Edited faculty member "${name}" (${id})` });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("editTeacherModal")).hide();
    showAlert(`Faculty ${name} updated.`, "success");
    await loadAllAdminData();
  });

  document.getElementById("studentClassFilter")?.addEventListener("change", renderStudentTable);
  document.getElementById("attendanceClassFilter")?.addEventListener("change", renderAttendanceTable);
  document.getElementById("attendanceDateFilter")?.addEventListener("change", renderAttendanceTable);
  document.getElementById("adminSummaryDateFilter")?.addEventListener("change", (e) => {
    const dt = e.target.value || formatDate(new Date());
    renderClassAttendanceSummary(dt);
  });

  loadAllAdminData();
}


// ==========================================
// 4. Teacher Dashboard Module (Multiple Classes Support)
// ==========================================

// Multiple Classes Support with Confirmation (No password required)
let pendingSwitchClassId = null;

function cleanupModalBackdrops() {
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('padding-right');
  document.body.style.removeProperty('overflow');
}
window.cleanupModalBackdrops = cleanupModalBackdrops;

async function switchTeacherClass(newClassId) {
  if (!newClassId) return;
  const currentClassId = localStorage.getItem('classid') || getQueryParam('classid');
  if (newClassId === currentClassId) return;

  pendingSwitchClassId = newClassId;
  const classesList = await getAll('classes');
  const targetClass = classesList.find(c => c.id === newClassId);
  const currentClass = classesList.find(c => c.id === currentClassId);
  const targetName = targetClass ? `${targetClass.name || targetClass.id} (${targetClass.id})` : newClassId;
  const currentName = currentClass ? `${currentClass.name || currentClass.id} (${currentClass.id})` : currentClassId;

  const modalEl = document.getElementById('switchClassModal');
  if (modalEl && window.bootstrap && typeof bootstrap.Modal !== 'undefined') {
    const curLabel = document.getElementById('switchCurrentClassLabel');
    const tgtLabel = document.getElementById('switchTargetClassLabel');
    if (curLabel) curLabel.textContent = currentName;
    if (tgtLabel) tgtLabel.textContent = targetName;

    cleanupModalBackdrops();
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } else {
    // Standard confirm fallback (No password required)
    const confirmed = confirm(`Confirm Class Switch:\n\nDo you want to switch your active section from "${currentName}" to "${targetName}"?\n(No password required)`);
    if (confirmed) {
      await applyTeacherClassSwitch(newClassId);
    } else {
      cancelClassSwitch();
    }
  }
}
window.switchTeacherClass = switchTeacherClass;

async function executeClassSwitch() {
  const modalEl = document.getElementById('switchClassModal');
  if (modalEl && window.bootstrap) {
    try {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    } catch (e) {
      console.warn("Modal hide error:", e);
    }
  }
  cleanupModalBackdrops();

  if (pendingSwitchClassId) {
    const targetId = pendingSwitchClassId;
    pendingSwitchClassId = null;
    await applyTeacherClassSwitch(targetId);
  }
}
window.executeClassSwitch = executeClassSwitch;

function cancelClassSwitch() {
  const modalEl = document.getElementById('switchClassModal');
  if (modalEl && window.bootstrap) {
    try {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    } catch (e) {
      console.warn("Modal hide error:", e);
    }
  }
  cleanupModalBackdrops();

  const currentClassId = localStorage.getItem('classid') || getQueryParam('classid');
  const switcher = document.getElementById('teacherClassSwitcher');
  if (switcher && currentClassId) {
    switcher.value = currentClassId;
  }
  pendingSwitchClassId = null;
}
window.cancelClassSwitch = cancelClassSwitch;

async function applyTeacherClassSwitch(newClassId) {
  cleanupModalBackdrops();
  localStorage.setItem('classid', newClassId);
  const teacherId = localStorage.getItem('teacherid') || getQueryParam('teacherid');
  const newUrl = `teacherlogin.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(newClassId)}`;
  window.history.replaceState(null, '', newUrl);

  const classesList = await getAll('classes');
  const targetClass = classesList.find(c => c.id === newClassId);
  const className = targetClass ? (targetClass.name || targetClass.id) : newClassId;

  showAlert(`Active section switched to ${className} (${newClassId})`, "success");
  await loadTeacherInfo();
  pendingSwitchClassId = null;
}

async function loadTeacherInfo() {
  testDatabaseConnection();
  let teacherId = localStorage.getItem('teacherid') || getQueryParam('teacherid');
  let classId = localStorage.getItem('classid') || getQueryParam('classid');

  if (!teacherId || !classId) {
    showAlert("Missing faculty or section context. Please login.", "warning");
    window.location.href = "login.html";
    return;
  }

  // Keep storage in sync
  localStorage.setItem('teacherid', teacherId);
  localStorage.setItem('classid', classId);

  const teachers = await getAll('teachers');
  const teacher = teachers.find(t => (t.teacherid || t.id) === teacherId);
  let teacherDisplay = teacherId;
  if (teacher && teacher.name) teacherDisplay = `${teacher.name} (${teacherId})`;

  const classesList = await getAll('classes');

  // Populate multiple class switcher
  const classSwitcher = document.getElementById('teacherClassSwitcher');
  if (classSwitcher) {
    classSwitcher.innerHTML = classesList.map(c =>
      `<option value="${c.id}"${c.id === classId ? " selected" : ""}>${c.name || c.id} (${c.id})</option>`
    ).join('');
    classSwitcher.value = classId;
  }

  const userEl = document.getElementById('username');
  if (userEl) userEl.textContent = teacherDisplay;
  const classEl = document.getElementById('class-id');
  if (classEl) classEl.textContent = classId;

  // Update Holiday Modal context display
  const modalClassDisplay = document.getElementById('holidayModalClassDisplay');
  if (modalClassDisplay) modalClassDisplay.textContent = `Class ${classId}`;

  // Update Student count for this active class
  const allStudents = await getAll('students');
  const classStudents = allStudents.filter(s => s.classId === classId || s.classid === classId);
  const rosterStats = document.getElementById('classRosterStats');
  if (rosterStats) rosterStats.textContent = `${classStudents.length} Students Enrolled in this Section`;

  // Check today's attendance status & Sunday/Holiday status
  const todayStr = formatDate(new Date());
  const holidayCheck = await isDateHoliday(todayStr, classId);
  const attendanceRecords = await getAll('attendance');
  const todayRecords = attendanceRecords.filter(r => (r.classId === classId || r.classid === classId) && r.date === todayStr);

  const statusBadge = document.getElementById('todayStatusBadge');
  if (statusBadge) {
    if (holidayCheck.isHoliday) {
      statusBadge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 fs-6 rounded-pill';
      statusBadge.innerHTML = `<i class="bi bi-calendar2-x me-1"></i> Today is Off (${holidayCheck.reason})`;
    } else if (todayRecords.length > 0) {
      statusBadge.className = 'badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fs-6 rounded-pill';
      statusBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Today\'s Attendance Recorded';
    } else {
      statusBadge.className = 'badge bg-warning-subtle text-warning border border-warning-subtle px-3 py-2 fs-6 rounded-pill';
      statusBadge.innerHTML = '<i class="bi bi-clock-history me-1"></i> Attendance Pending for Today';
    }
  }
}

function goToAttendance() {
  let teacherId = localStorage.getItem('teacherid') || getQueryParam('teacherid');
  let classId = localStorage.getItem('classid') || getQueryParam('classid');
  if (!teacherId || !classId) {
    showAlert("Missing faculty credentials.", "warning");
    return;
  }
  window.location.href = `attendance.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
}

function updateDateTime() {
  const dateEl = document.getElementById("date-time");
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString();
  }
}

window.goToAttendance = goToAttendance;

function initTeacherLoginPage() {
  loadTeacherInfo();
  updateDateTime();
  setInterval(updateDateTime, 1000);

  const holidayDateInput = document.getElementById('holidayDate');
  if (holidayDateInput && !holidayDateInput.value) {
    holidayDateInput.value = formatDate(new Date());
  }
}


// ==========================================
// 5. Attendance Mark Module (With Sunday / Holiday Guard & Multiple Classes)
// ==========================================

let currentTeacherId = '';
let currentClassId = '';
let classStudents = [];

async function switchAttendanceClass(newClassId) {
  if (!newClassId) return;
  const prevClassId = currentClassId;
  if (newClassId === prevClassId) return;

  const classesList = await getAll('classes');
  const targetClass = classesList.find(c => c.id === newClassId);
  const className = targetClass ? (targetClass.name || targetClass.id) : newClassId;

  const confirmed = confirm(`Confirm Class Switch:\n\nDo you want to switch attendance roster to "${className} (${newClassId})"?`);
  if (!confirmed) {
    const switcher = document.getElementById('attendanceClassSwitcher');
    if (switcher) switcher.value = prevClassId;
    return;
  }

  localStorage.setItem('classid', newClassId);
  currentClassId = newClassId;
  const newUrl = `attendance.html?teacherid=${encodeURIComponent(currentTeacherId)}&classid=${encodeURIComponent(newClassId)}`;
  window.history.replaceState(null, '', newUrl);

  showAlert(`Switched attendance roster to ${className} (${newClassId})`, "info");
  await initAttendancePage();
}
window.switchAttendanceClass = switchAttendanceClass;

function updateLiveAttendanceStats() {
  const checkboxes = document.querySelectorAll('.student-checkbox');
  const total = checkboxes.length;
  let present = 0;

  checkboxes.forEach(cb => {
    const row = cb.closest('tr');
    if (cb.checked) {
      present++;
      if (row) {
        row.classList.add('tr-present');
        row.classList.remove('tr-absent');
      }
    } else {
      if (row) {
        row.classList.add('tr-absent');
        row.classList.remove('tr-present');
      }
    }
  });

  const absent = total - present;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const totalEl = document.getElementById('liveTotalCount');
  if (totalEl) totalEl.textContent = total;

  const presentEl = document.getElementById('livePresentCount');
  if (presentEl) presentEl.textContent = present;

  const absentEl = document.getElementById('liveAbsentCount');
  if (absentEl) absentEl.textContent = absent;

  const rateEl = document.getElementById('liveRate');
  if (rateEl) rateEl.textContent = `${rate}%`;

  const barEl = document.getElementById('liveProgressBar');
  if (barEl) {
    barEl.style.width = `${rate}%`;
    if (rate >= 75) {
      barEl.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
    } else if (rate >= 50) {
      barEl.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
    } else {
      barEl.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
    }
  }

  const modalTotal = document.getElementById('modalConfirmTotal');
  if (modalTotal) modalTotal.textContent = total;
  const modalPresent = document.getElementById('modalConfirmPresent');
  if (modalPresent) modalPresent.textContent = present;
  const modalAbsent = document.getElementById('modalConfirmAbsent');
  if (modalAbsent) modalAbsent.textContent = absent;
  const modalRate = document.getElementById('modalConfirmRate');
  if (modalRate) modalRate.textContent = `${rate}%`;
}
window.updateLiveAttendanceStats = updateLiveAttendanceStats;

function markAllAttendance(isPresent) {
  const checkboxes = document.querySelectorAll('.student-checkbox:not(:disabled)');
  checkboxes.forEach(cb => {
    cb.checked = isPresent;
  });
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) selectAllCheckbox.checked = isPresent;
  updateLiveAttendanceStats();
}
window.markAllAttendance = markAllAttendance;

function filterAttendanceTableLive() {
  const query = document.getElementById('attendanceSearchInput')?.value.toLowerCase().trim();
  const rows = document.querySelectorAll('#studentTable tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}
window.filterAttendanceTableLive = filterAttendanceTableLive;

async function initAttendancePage() {
  testDatabaseConnection();
  currentTeacherId = getQueryParam('teacherid') || localStorage.getItem('teacherid');
  currentClassId = getQueryParam('classid') || localStorage.getItem('classid');

  if (!currentTeacherId || !currentClassId) {
    showAlert('Missing credentials. Redirecting to login.', "warning");
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return;
  }

  const teachers = await getAll('teachers');
  const teacher = teachers.find(t => t.id === currentTeacherId);
  const teacherDisplay = teacher ? `${teacher.name} (${currentTeacherId})` : currentTeacherId;

  const classesList = await getAll('classes');
  const classSwitcher = document.getElementById('attendanceClassSwitcher');
  if (classSwitcher) {
    classSwitcher.innerHTML = classesList.map(c =>
      `<option value="${c.id}"${c.id === currentClassId ? " selected" : ""}>${c.name || c.id} (${c.id})</option>`
    ).join('');
  }

  const userEl = document.getElementById('username');
  if (userEl) userEl.textContent = teacherDisplay;

  await loadStudents();

  document.getElementById('selectAllCheckbox')?.addEventListener('change', function(e) {
    markAllAttendance(e.target.checked);
  });

  document.getElementById('attendanceForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    if (classStudents.length === 0) return showAlert('No enrolled students in this section.', "warning");
    const submitBtn = document.getElementById('submitAttendanceBtn');
    if (submitBtn && submitBtn.disabled) {
      return showAlert('Attendance session for today is already completed or on non-instructional day.', "info");
    }
    updateLiveAttendanceStats();
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
      message: `Faculty ${teacherDisplay} marked attendance for Class ${currentClassId} on ${todayStr} (${presentCount} Present, ${absentCount} Absent)`,
      classId: currentClassId,
      date: todayStr
    });

    showAlert(`Attendance session submitted! (${presentCount} Present, ${absentCount} Absent)`, "success");
    setTimeout(() => {
      window.location.href = `teacherlogin.html?teacherid=${encodeURIComponent(currentTeacherId)}&classid=${encodeURIComponent(currentClassId)}`;
    }, 1200);
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
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted">No students currently registered in this section.</td></tr>`;
    return;
  }

  const prevAttendance = await getYesterdayAttendance(currentClassId);
  const todayStr = formatDate(new Date());

  // Check Sunday or Holiday status
  const holidayCheck = await isDateHoliday(todayStr, currentClassId);
  const isHolidayToday = holidayCheck.isHoliday;

  const records = await getAll('attendance');
  const todayRecords = records.filter(r =>
    (r.classId === currentClassId || r.classid === currentClassId) &&
    r.date === todayStr
  );
  const isAlreadySubmitted = todayRecords.length > 0;

  const submitBtn = document.getElementById('submitAttendanceBtn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const sundayNotice = document.getElementById('sundayHolidayNotice');

  if (isHolidayToday) {
    if (sundayNotice) {
      sundayNotice.style.display = 'flex';
      const noticeTitle = document.getElementById('sundayHolidayNoticeTitle');
      const noticeDesc = document.getElementById('sundayHolidayNoticeDesc');
      if (noticeTitle) noticeTitle.textContent = isDateSunday(todayStr) ? 'Sunday Weekly Off' : 'Holiday Declared';
      if (noticeDesc) noticeDesc.textContent = `Today is observed as ${holidayCheck.reason}. Academic attendance sessions are paused.`;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="bi bi-calendar2-x"></i> Non-Instructional Day (${holidayCheck.reason})`;
      submitBtn.className = "btn btn-warning mt-3 px-4";
    }
    if (selectAllCheckbox) selectAllCheckbox.disabled = true;
  } else {
    if (sundayNotice) sundayNotice.style.display = 'none';
    if (isAlreadySubmitted) {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="bi bi-check2-circle"></i> Attendance Already Recorded Today`;
        submitBtn.className = "btn btn-secondary mt-3 px-4";
      }
      if (selectAllCheckbox) selectAllCheckbox.disabled = true;
    } else {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="bi bi-cloud-arrow-up-fill"></i> Submit Attendance Record`;
        submitBtn.className = "btn btn-success px-4 py-2";
      }
      if (selectAllCheckbox) selectAllCheckbox.disabled = false;
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
      const adminRec = todayRecords.find(r => (r.studentId === student.id || r.studentid === student.id) && r.markedByAdmin);
      const teacherRec = todayRecords.find(r => (r.studentId === student.id || r.studentid === student.id) && !r.markedByAdmin);
      const studRec = adminRec || teacherRec;
      if (studRec && studRec.status === 'Present') {
        isChecked = true;
      }
      isDisabled = true;
    } else {
      isChecked = true;
    }

    tableHTML += `
      <tr class="${isChecked ? 'tr-present' : 'tr-absent'}">
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center" style="width: 36px; height: 36px; font-size: 0.85rem;">
              ${student.name.charAt(0)}
            </div>
            <div>
              <strong>${student.name}</strong>
              <div class="text-muted small">Scholar ID: <span class="font-monospace">${student.id}</span></div>
            </div>
          </div>
        </td>
        <td class="text-center">
          <span class="badge ${badgeClass} px-2 py-1">${prevStatus}</span>
        </td>
        <td class="text-center">
          <input type="checkbox" class="student-checkbox form-check-input" data-studentid="${student.id}" style="cursor: pointer; transform: scale(1.25);"${isChecked ? ' checked' : ''}${isDisabled ? ' disabled' : ''} onchange="updateLiveAttendanceStats()">
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = tableHTML;

  updateLiveAttendanceStats();
}

async function clearAttendanceForToday(classId, date) {
  const records = await getAll('attendance');
  const filtered = records.filter(r => !((r.classId === classId || r.classid === classId) && r.date === date && !r.markedByAdmin));
  localStorage.setItem('attendanceDB_attendance', JSON.stringify(filtered));
}

// Teacher Declares Class Holiday with Password Authorization & Explicit Log Attribution
async function confirmHoliday() {
  const holidayDate = document.getElementById('holidayDate')?.value || formatDate(new Date());
  const reason = document.getElementById('holidayReason')?.value.trim();
  const password = document.getElementById('teacherPassword')?.value;

  if (!holidayDate) return showAlert('Please select a holiday date.', "warning");
  if (!reason) return showAlert('Please provide a reason for the holiday.', "warning");
  if (!password) return showAlert('Please enter your faculty password to confirm.', "warning");

  const teacherId = currentTeacherId || getQueryParam('teacherid') || localStorage.getItem('teacherid') || '';
  const classId = currentClassId || getQueryParam('classid') || localStorage.getItem('classid') || '';

  if (!teacherId || !classId) {
    return showAlert('Missing faculty credentials.', "danger");
  }

  const teachers = await getAll('teachers');
  const teacher = teachers.find(t => t.id === teacherId);

  // Authenticate teacher password
  if (!teacher || teacher.password !== password) {
    return showAlert('Invalid faculty password! Authorization denied.', "danger");
  }

  const holidays = await getAll('holidays');
  if (holidays.some(h => h.date === holidayDate && (h.classId === classId || h.classId === 'all'))) {
    bootstrap.Modal.getInstance(document.getElementById('holidayModal')).hide();
    return showAlert(`Holiday already declared for ${holidayDate}.`, "info");
  }

  const holidayRecord = {
    date: holidayDate,
    reason: reason,
    classId: classId,
    declaredBy: `Faculty: ${teacher.name} (${teacher.id})`,
    teacherId: teacher.id
  };

  await save('holidays', holidayRecord);
  await clearAttendanceForToday(classId, holidayDate);

  // Mention explicitly in audit logs who gave the holiday
  await addLog({
    type: 'Holiday',
    message: `Class Holiday declared by Faculty "${teacher.name}" (ID: ${teacher.id}) for Class ${classId} on ${holidayDate}. Reason: "${reason}"`,
    classId: classId,
    date: holidayDate,
    details: { declaredBy: teacher.name, teacherId: teacher.id }
  });

  bootstrap.Modal.getOrCreateInstance(document.getElementById('holidayModal')).hide();
  showAlert(`Holiday on ${holidayDate} authorized by Professor ${teacher.name}!`, "success");

  setTimeout(() => {
    window.location.href = `teacherlogin.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(classId)}`;
  }, 1200);
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
  updateDateTime();
  setInterval(updateDateTime, 1000);
}


// ==========================================
// 6. Reports Dashboard Module (Advanced Clean Historical Logs)
// ==========================================

let attendanceRecords = [];
let holidayDatesSet = new Set();
let reportStudents = [];
let reportClasses = [];

function getClassId() {
  return getQueryParam('classid') || localStorage.getItem('classid') || '';
}

async function switchReportClass(newClassId) {
  if (!newClassId) return;
  const prevClassId = localStorage.getItem('classid') || getQueryParam('classid');
  if (newClassId === prevClassId) return;

  const classesList = await getAll('classes');
  const targetClass = classesList.find(c => c.id === newClassId);
  const className = targetClass ? (targetClass.name || targetClass.id) : newClassId;

  const confirmed = confirm(`Confirm Class Switch:\n\nDo you want to switch report analytics to "${className} (${newClassId})"?`);
  if (!confirmed) {
    const switcher = document.getElementById('reportClassSwitcher');
    if (switcher) switcher.value = prevClassId;
    return;
  }

  localStorage.setItem('classid', newClassId);
  const teacherId = localStorage.getItem('teacherid') || getQueryParam('teacherid');
  const newUrl = `report.html?teacherid=${encodeURIComponent(teacherId)}&classid=${encodeURIComponent(newClassId)}`;
  window.history.replaceState(null, '', newUrl);

  showAlert(`Viewing report analytics for ${className} (${newClassId})`, "info");
  await initReportPage();
}
window.switchReportClass = switchReportClass;

async function setTeacherAndClassInfo(classesList) {
  testDatabaseConnection();
  const urlParams = new URLSearchParams(window.location.search);
  const teacherId = urlParams.get('teacherid') || localStorage.getItem('teacherid');
  const classId = getClassId();

  if (!teacherId || !classId) {
    showAlert("Missing faculty or class context. Please login again.", "warning");
    window.location.href = "login.html";
    return;
  }

  const teachers = await getAll('teachers');
  const teacher = teachers.find(t => t.id === teacherId);
  const teacherName = teacher ? teacher.name : teacherId;

  const classSwitcher = document.getElementById('reportClassSwitcher');
  if (classSwitcher) {
    classSwitcher.innerHTML = classesList.map(c =>
      `<option value="${c.id}"${c.id === classId ? " selected" : ""}>${c.name || c.id} (${c.id})</option>`
    ).join('');
  }

  const userEl = document.getElementById('username');
  if (userEl) userEl.textContent = `${teacherName} (${teacherId})`;
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

// Clean, Advanced Historical Attendance Log representation
function renderAttendanceReport(filterDate, searchQuery) {
  const tbody = document.getElementById("attendanceReportTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  const classId = getClassId();

  const deduped = dedupAttendance(attendanceRecords, classId);
  let filtered = deduped;

  if (filterDate) {
    filtered = filtered.filter(r => r.date === filterDate);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(r => {
      const sid = (r.studentId || r.studentid || r.id || '').toLowerCase();
      const student = reportStudents.find(s => s.id === (r.studentId || r.studentid || r.id));
      const sname = student ? student.name.toLowerCase() : '';
      return sid.includes(q) || sname.includes(q);
    });
  }

  filtered.sort((a, b) => b.date.localeCompare(a.date));

  // Compute live statistics for filtered records ribbon
  const totalRec = filtered.length;
  const presentRec = filtered.filter(r => r.status === 'Present').length;
  const absentRec = totalRec - presentRec;
  const effectiveRate = totalRec > 0 ? Math.round((presentRec / totalRec) * 100) : 0;

  const cntEl = document.getElementById('logRecordCount');
  if (cntEl) cntEl.textContent = totalRec;
  const presEl = document.getElementById('logPresentCount');
  if (presEl) presEl.textContent = presentRec;
  const absEl = document.getElementById('logAbsentCount');
  if (absEl) absEl.textContent = absentRec;
  const rateEl = document.getElementById('logEffectiveRate');
  if (rateEl) rateEl.textContent = `${effectiveRate}%`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No attendance records match your filter criteria.</td></tr>`;
    return;
  }

  let tableHTML = "";
  filtered.forEach(r => {
    const student = reportStudents.find(s => s.id === (r.studentId || r.studentid || r.id));
    const studentName = student ? student.name : `Scholar (${r.studentId || r.studentid || r.id})`;
    const studentId = r.studentId || r.studentid || r.id;

    // Day of week formatting
    const d = new Date(r.date + 'T00:00:00');
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    const isPresent = r.status === 'Present';
    const authority = r.markedByAdmin ? 'Admin Override' : 'Faculty Verified';

    tableHTML += `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-light text-dark border px-2 py-1 font-monospace">${dayName}</span>
            <span class="fw-semibold">${r.date}</span>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-circle ${isPresent ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} fw-bold d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; font-size: 0.8rem;">
              ${studentName.charAt(0)}
            </div>
            <div>
              <strong>${studentName}</strong>
              <div class="text-muted small">Roll ID: <span class="font-monospace">${studentId}</span></div>
            </div>
          </div>
        </td>
        <td class="text-center">
          <span class="badge ${isPresent ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'} px-3 py-1 fs-6">
            <i class="bi ${isPresent ? 'bi-check-lg me-1' : 'bi-x-lg me-1'}"></i>${r.status}
          </span>
        </td>
        <td class="text-center">
          <span class="badge bg-light text-muted border">${authority}</span>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = tableHTML;
}

function quickFilterReportDate(preset) {
  const dateInput = document.getElementById('dateFilter');
  if (preset === 'today') {
    const today = formatDate(new Date());
    if (dateInput) dateInput.value = today;
    renderAttendanceReport(today);
  } else if (preset === 'yesterday') {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = formatDate(yest);
    if (dateInput) dateInput.value = yestStr;
    renderAttendanceReport(yestStr);
  } else {
    if (dateInput) dateInput.value = '';
    renderAttendanceReport('');
  }
}
window.quickFilterReportDate = quickFilterReportDate;

function filterReportTableLive() {
  const query = document.getElementById('reportSearchInput')?.value;
  const dateVal = document.getElementById('dateFilter')?.value;
  renderAttendanceReport(dateVal, query);
}
window.filterReportTableLive = filterReportTableLive;

function exportReportToCSV() {
  const classId = getClassId();
  const deduped = dedupAttendance(attendanceRecords, classId);
  if (!deduped.length) return showAlert("No attendance data to export.", "warning");

  let csv = "Session Date,Student ID,Student Name,Class ID,Status,Authority\n";
  deduped.forEach(r => {
    const sid = r.studentId || r.studentid || r.id;
    const student = reportStudents.find(s => s.id === sid);
    const sname = student ? student.name : sid;
    const auth = r.markedByAdmin ? 'Admin Override' : 'Faculty';
    csv += `"${r.date}","${sid}","${sname}","${classId}","${r.status}","${auth}"\n`;
  });

  downloadCSV(csv, `attendance_report_${classId}.csv`);
  showAlert("Class attendance report exported to CSV.", "success");
}
window.exportReportToCSV = exportReportToCSV;

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
        backgroundColor: ['#10b981', '#ef4444'],
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600', size: 13 }, color: '#475569' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${ctx.label}: ${value} (${total ? ((value / total) * 100).toFixed(1) : 0}%)`;
            }
          }
        }
      }
    }
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
          label: 'Present Scholars',
          data: presentCounts,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Absent Scholars',
          data: absentCounts,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#ef4444'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600', size: 12 }, color: '#475569' }
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

function getStrength(date) {
  const classId = getClassId();
  const records = attendanceRecords.filter(r =>
    (r.classId === classId || r.classid === classId) && r.date === date
  );
  if (!records.length) return "Not Recorded";
  const present = records.filter(r => r.status === "Present").length;
  const rate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;
  return `${present}/${records.length} (${rate}%)`;
}

async function initReportPage() {
  testDatabaseConnection();
  reportClasses = await getAll('classes');
  await setTeacherAndClassInfo(reportClasses);

  reportStudents = await getAll('students');
  attendanceRecords = await getAll('attendance');
  const holidays = await getAll('holidays');
  holidayDatesSet = new Set(holidays.map(h => h.date));

  const today = formatDate(new Date());
  const prevDate = new Date();
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = formatDate(prevDate);

  const todayStrengthEl = document.getElementById('todayStrength');
  if (todayStrengthEl) todayStrengthEl.textContent = getStrength(today);

  const prevDayStrengthEl = document.getElementById('prevDayStrength');
  if (prevDayStrengthEl) prevDayStrengthEl.textContent = getStrength(prevDateStr);

  renderAttendanceDoughnutChart();
  renderDailyLineChart();
  renderAttendanceReport();

  document.getElementById('dateFilter')?.addEventListener('change', (e) => {
    renderAttendanceReport(e.target.value);
  });

  updateDateTime();
  setInterval(updateDateTime, 1000);
}


// ==========================================
// 7. Student Portal Module (Advanced Calendar & Sundays/Holidays Representation)
// ==========================================

function updateStudentDateTime() {
  const dateTimeEl = document.getElementById("date-time");
  if (dateTimeEl) {
    const now = new Date();
    dateTimeEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString();
  }
}

function initStudentLoginPage() {
  updateStudentDateTime();
  setInterval(updateStudentDateTime, 1000);

  const performSearch = async (studentId) => {
    const students = await getAll('students');
    const student = students.find(s => s.id === studentId || s.studentid === studentId);
    if (!student) return showAlert(`Student record "${studentId}" not found.`, "danger");

    const classId = student.classId || student.classid;
    const classIdEl = document.getElementById('class-id');
    if (classIdEl) classIdEl.textContent = `${classId}`;

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
    const totalWorkingDays = presents + absents;
    const numericPercentage = totalWorkingDays > 0 ? ((presents / totalWorkingDays) * 100) : 0;
    const percentage = numericPercentage.toFixed(1) + '%';

    let healthBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-1"><i class="bi bi-shield-check me-1"></i> Excellent Standing (≥75% Met)</span>`;
    if (numericPercentage < 75 && totalWorkingDays > 0) {
      healthBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-1"><i class="bi bi-exclamation-triangle me-1"></i> Attendance Alert: Below 75% Requirement</span>`;
    }

    const holidays = await getAll('holidays');
    const applicableHolidays = holidays.filter(h => h.classId === 'all' || !h.classId || h.classId === classId);

    const detailsEl = document.getElementById('studentDetails');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <div class="card p-4 shadow-sm w-100 bg-white">
          <div class="row align-items-center">
            <div class="col-md-5 mb-3 mb-md-0">
              <div class="d-flex align-items-center gap-3">
                <div class="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center shadow-sm" style="width: 58px; height: 58px; font-size: 1.4rem;">
                  ${student.name.charAt(0)}
                </div>
                <div>
                  <h4 class="fw-bold mb-1">${student.name}</h4>
                  <div class="text-muted small">Scholar ID: <span class="font-monospace fw-semibold">${studentId}</span> • Class: <span class="badge bg-light text-muted border">${classId}</span></div>
                  <div class="mt-2">${healthBadge}</div>
                </div>
              </div>
            </div>
            <div class="col-md-7">
              <div class="row g-2 text-center">
                <div class="col-3">
                  <div class="p-2 border rounded-3 bg-light">
                    <div class="text-primary fw-bold fs-4">${totalWorkingDays}</div>
                    <small class="text-muted fw-bold text-uppercase" style="font-size: 0.68rem;">Working Days</small>
                  </div>
                </div>
                <div class="col-3">
                  <div class="p-2 border rounded-3 bg-light">
                    <div class="text-success fw-bold fs-4">${presents}</div>
                    <small class="text-muted fw-bold text-uppercase" style="font-size: 0.68rem;">Present</small>
                  </div>
                </div>
                <div class="col-3">
                  <div class="p-2 border rounded-3 bg-light">
                    <div class="text-danger fw-bold fs-4">${absents}</div>
                    <small class="text-muted fw-bold text-uppercase" style="font-size: 0.68rem;">Absent</small>
                  </div>
                </div>
                <div class="col-3">
                  <div class="p-2 border rounded-3 bg-light">
                    <div class="text-primary fw-bold fs-4">${percentage}</div>
                    <small class="text-muted fw-bold text-uppercase" style="font-size: 0.68rem;">Rate</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    let calendarEvents = [];

    // Add Present / Absent Events
    for (const date in attendanceByDate) {
      const record = attendanceByDate[date];
      let color = record.status === 'Present' ? '#10b981' : (record.status === 'Absent' ? '#ef4444' : '#64748b');
      calendarEvents.push({
        title: record.status === 'Present' ? '✓ Present' : '✕ Absent',
        start: date,
        allDay: true,
        backgroundColor: color,
        borderColor: color
      });
    }

    // Add Declared & Public Holidays Events
    for (const h of applicableHolidays) {
      calendarEvents.push({
        title: `🎉 ${h.reason}`,
        start: h.date,
        allDay: true,
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b'
      });
    }

    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
      calendarEl.innerHTML = '';

      try {
        if (typeof FullCalendar === 'undefined') {
          console.error("FullCalendar library is not available.");
          calendarEl.innerHTML = '<div class="alert alert-warning">Calendar engine is loading or unavailable offline.</div>';
          return;
        }

        const calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          height: 'auto',
          contentHeight: 'auto',
          aspectRatio: window.innerWidth < 768 ? 1.05 : 1.6,
          handleWindowResize: true,
          expandRows: true,
          dayMaxEvents: 3,
          initialDate: myAttendance.length > 0 ? myAttendance[0].date : formatDate(new Date()),
          locale: 'en',
          events: calendarEvents,
          headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listMonth'
          }
        });
        calendar.render();

        setTimeout(() => {
          calendar.updateSize();
        }, 100);

        window.addEventListener('resize', () => {
          calendar.updateSize();
        });
      } catch (calErr) {
        console.error("Error initializing FullCalendar:", calErr);
        calendarEl.innerHTML = `<div class="alert alert-warning">Failed to load calendar schedule: ${calErr.message}</div>`;
      }
    }
  };

  document.getElementById('searchBtn')?.addEventListener('click', async () => {
    const studentIdInput = document.getElementById('studentIdInput');
    if (!studentIdInput) return;
    const studentId = studentIdInput.value.trim();
    if (!studentId) return showAlert('Please enter your Student ID.', "warning");
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
  console.log("Student Attendance System engine running, state:", document.readyState);

  // Seed database if empty before page init
  await seedDatabaseIfEmpty();

  // Test local database connection
  if (document.getElementById('dbStatusBadge')) {
    testDatabaseConnection();
  }

  // Page Routing based on elements/pathname
  if (document.getElementById('loginForm')) {
    initLoginPage();
  } else if (document.getElementById('classSummaryContainer')) {
    if (!checkAdminAuth()) return;
    initAdminPage();
  } else if (window.location.pathname.includes('teacherlogin.html')) {
    initTeacherLoginPage();
  } else if (document.getElementById('attendanceForm')) {
    initAttendanceMarkPage();
  } else if (document.getElementById('attendanceReportTable')) {
    initReportPage();
  } else if (document.getElementById('calendar')) {
    initStudentLoginPage();
  }
}

window.addEventListener("DOMContentLoaded", runRouterInit);
