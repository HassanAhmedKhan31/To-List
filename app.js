// -- Setup & Utilities --------------------------------
const firebaseRequest = (path, opts = {}) =>
  fetch(`https://todo-29872-default-rtdb.firebaseio.com${path}.json`, opts);

const el = id => document.getElementById(id);
const inputEl = el('todoText'), addBtn = el('addTodo'),
      deleteAllBtn = el('deleteAll'),
      listEl = el('list'),
      listSel = el('listSelector'),
      createListBtn = el('createList'),
      newListInput = el('newListName'),
      renameListBtn = el('renameList'),
      deleteListBtn = el('deleteList'),
      toggleThemeBtn = el('toggleTheme'),
      exportBtn = el('exportData'),
      importInput = el('importFile');

let currentList = 'default';
let editingId = null;

// -- Theme Handling -----------------------------------
toggleThemeBtn.onclick = () => {
  const d = document.body.getAttribute('data-theme');
  document.body.setAttribute('data-theme', d === 'light' ? 'dark' : 'light');
};

// -- Storage (Firebase + localStorage Fallback) -------
async function fetchTodos(path, opts) {
  try {
    return await firebaseRequest(path, opts).then(r => r.json());
  } catch {
    // fallback to localStorage
    if (opts.method === 'GET' || !opts.method) {
      const data = JSON.parse(localStorage.getItem(path) || 'null');
      return data;
    } else {
      // write back after modification
      let all = JSON.parse(localStorage.getItem(path) || '{}');
      if (opts.method === 'DELETE') {
        all = {}; 
      } else if (opts.method === 'PUT') {
        all[path.split('/').pop()] = JSON.parse(opts.body);
      } else if (opts.method === 'POST') {
        const id = Date.now().toString();
        all[id] = JSON.parse(opts.body);
        opts.resultName = id;
      }
      localStorage.setItem(path, JSON.stringify(all));
      return opts.resultName || all;
    }
  }
}

// -- List Management -----------------------------------
async function loadListOptions() {
  const data = await fetchTodos('/todos', {});
  listSel.innerHTML = '';
  if (data) Object.keys(data).forEach(n => {
    const o = document.createElement('option');
    o.value = o.textContent = n;
    listSel.append(o);
  });
  listSel.value = currentList;
}

async function switchList(name) {
  currentList = name;
  editingId = null;
  addBtn.textContent = 'Add Todo';
  listEl.innerHTML = '';
  await loadList();
}

// -- Todo Management -----------------------------------
async function loadList() {
  const data = await fetchTodos(`/todos/${currentList}`, {});
  if (data) Object.entries(data).forEach(([id, text]) => addTodoDOM(id, text));
}

function addTodoDOM(id, text) {
  const li = document.createElement('li');
  const span = document.createElement('span');
  span.textContent = text;
  const edit = document.createElement('button'); edit.textContent = '✎';
  const del  = document.createElement('button'); del.textContent = '🗑️';

  edit.onclick = () => {
    inputEl.value = text;
    addBtn.textContent = 'Save';
    editingId = id;
  };
  del.onclick = async () => {
    li.remove();
    await fetchTodos(`/todos/${currentList}/${id}`, { method: 'DELETE' });
  };

  li.append(span, edit, del);
  listEl.append(li);
}

addBtn.onclick = async () => {
  const txt = inputEl.value.trim();
  if (!txt) return;
  if (editingId) {
    document.querySelector(`#${editingId} span`).textContent = txt;
    await fetchTodos(`/todos/${currentList}/${editingId}`, {
      method: 'PUT',
      body: JSON.stringify(txt)
    });
    editingId = null;
    addBtn.textContent = 'Add Todo';
  } else {
    const res = await fetchTodos(`/todos/${currentList}`, {
      method: 'POST',
      body: JSON.stringify(txt)
    });
    addTodoDOM(res.name || Date.now().toString(), txt);
  }
  inputEl.value = '';
};

deleteAllBtn.onclick = async () => {
  listEl.innerHTML = '';
  await fetchTodos(`/todos/${currentList}`, { method: 'DELETE' });
};

// -- Create / Rename / Delete Lists -------------------
createListBtn.onclick = async () => {
  const name = newListInput.value.trim();
  if (!name) return alert('Enter valid list name.');
  currentList = name;
  await fetchTodos(`/todos/${currentList}`, { method: 'PUT', body: '{}' });
  newListInput.value = '';
  await loadListOptions();
  await switchList(name);
};

renameListBtn.onclick = async () => {
  const newName = prompt('New name for this list:');
  if (!newName) return;
  const data = await fetchTodos(`/todos/${currentList}`, {});
  await fetchTodos(`/todos/${newName}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  await fetchTodos(`/todos/${currentList}`, { method: 'DELETE' });
  currentList = newName;
  await loadListOptions();
  await switchList(newName);
};

deleteListBtn.onclick = async () => {
  if (!confirm(`Delete list "${currentList}"? This cannot be undone.`)) return;
  await fetchTodos(`/todos/${currentList}`, { method: 'DELETE' });
  await fetchTodos('/todos', {}); // refresh
  currentList = 'default';
  await loadListOptions();
  await switchList(currentList);
};

// -- Export / Import -----------------------------------
exportBtn.onclick = () => {
  const data = JSON.stringify(
    { lists: JSON.parse(localStorage.getItem('/todos') || '{}') },
    null, 2
  );
  const b = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'todo-data.json';
  a.click();
};

importInput.onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const obj = JSON.parse(await f.text());
  await fetchTodos('/todos', {
    method: 'PUT',
    body: JSON.stringify(obj.lists || {})
  });
  await loadListOptions();
  await switchList(currentList);
};

// -- Init app ----------------------------------------
(async function init() {
  await loadListOptions();
  await switchList(currentList);
})();
