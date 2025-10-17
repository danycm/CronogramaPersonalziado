document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const ganttChartArea = document.querySelector('.gantt-chart-area');
    const saveBtn = document.getElementById('save');
    const loadBtn = document.getElementById('load');
    const shareBtn = document.getElementById('share');
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportPngBtn = document.getElementById('export-png');
    const exportCsvBtn = document.getElementById('export-csv');

    let tasks = [];
    let nextTaskId = 1;
    let editingTaskId = null;

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const taskName = document.getElementById('task-name').value;
        const taskDescription = document.getElementById('task-description').value;
        const taskStart = document.getElementById('task-start').value;
        const taskEnd = document.getElementById('task-end').value;
        const taskProgress = document.getElementById('task-progress').value;
        const taskDependencies = document.getElementById('task-dependencies').value
            .split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id));

        const taskData = {
            name: taskName,
            description: taskDescription,
            start: taskStart,
            end: taskEnd,
            progress: taskProgress,
            dependencies: taskDependencies,
        };

        if (editingTaskId) {
            const task = tasks.find(t => t.id === editingTaskId);
            Object.assign(task, taskData);
            editingTaskId = null;
            taskForm.querySelector('button').textContent = 'Add Task';
        } else {
            taskData.id = nextTaskId++;
            tasks.push(taskData);
        }

        renderGanttChart();
        taskForm.reset();
    });

    function renderGanttChart() {
        ganttChartArea.innerHTML = '';

        if (tasks.length === 0) return;

        const ganttGrid = document.createElement('div');
        ganttGrid.className = 'gantt-grid';

        const minDate = new Date(Math.min(...tasks.map(t => new Date(t.start))));
        const maxDate = new Date(Math.max(...tasks.map(t => new Date(t.end))));

        // Add headers
        ganttGrid.appendChild(document.createElement('div')); // Empty corner
        let currentDate = new Date(minDate);
        while (currentDate <= maxDate) {
            const dateHeader = document.createElement('div');
            dateHeader.className = 'gantt-date-header';
            dateHeader.textContent = currentDate.toLocaleDateString();
            ganttGrid.appendChild(dateHeader);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Add tasks
        tasks.forEach(task => {
            const taskNameElement = document.createElement('div');
            taskNameElement.className = 'gantt-task-name';
            taskNameElement.textContent = task.name;
            ganttGrid.appendChild(taskNameElement);

            const taskBar = document.createElement('div');
            taskBar.className = 'gantt-task-bar';
            taskBar.draggable = true;
            taskBar.dataset.taskId = task.id;

            const startDate = new Date(task.start);
            const endDate = new Date(task.end);
            const duration = (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;

            taskBar.style.gridColumnStart = (startDate - minDate) / (1000 * 60 * 60 * 24) + 2;
            taskBar.style.gridColumnEnd = `span ${duration}`;
            taskBar.style.gridRow = tasks.indexOf(task) + 2;

            const taskNameElementInGrid = ganttGrid.querySelector(`.gantt-task-name[data-task-id="${task.id}"]`);
            if(taskNameElementInGrid) {
                taskNameElementInGrid.style.gridRow = tasks.indexOf(task) + 2;
            }

            taskBar.addEventListener('click', () => {
                editingTaskId = task.id;
                document.getElementById('task-name').value = task.name;
                document.getElementById('task-description').value = task.description;
                document.getElementById('task-start').value = task.start;
                document.getElementById('task-end').value = task.end;
                document.getElementById('task-progress').value = task.progress;
                document.getElementById('task-dependencies').value = task.dependencies.join(',');
                taskForm.querySelector('button').textContent = 'Update Task';
            });

            const progressBar = document.createElement('div');
            progressBar.className = 'gantt-task-progress';
            progressBar.style.width = `${task.progress}%`;
            taskBar.appendChild(progressBar);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'X';
            deleteBtn.className = 'delete-task';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                tasks = tasks.filter(t => t.id !== task.id);
                renderGanttChart();
            });
            taskBar.appendChild(deleteBtn);

            if (new Date(task.end) < new Date() && task.progress < 100) {
                taskBar.style.backgroundColor = 'red';
            }

            ganttGrid.appendChild(taskBar);
        });

        ganttChartArea.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
            e.target.style.opacity = '0.5';
        });

        ganttChartArea.addEventListener('dragend', (e) => {
            e.target.style.opacity = '1';
        });

        ganttChartArea.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        ganttChartArea.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedTaskId = parseInt(e.dataTransfer.getData('text/plain'));
            const targetTaskElement = e.target.closest('.gantt-task-bar');
            if (targetTaskElement) {
                const targetTaskId = parseInt(targetTaskElement.dataset.taskId);
                const draggedTaskIndex = tasks.findIndex(t => t.id === draggedTaskId);
                const targetTaskIndex = tasks.findIndex(t => t.id === targetTaskId);

                if (draggedTaskIndex !== -1 && targetTaskIndex !== -1) {
                    const [draggedTask] = tasks.splice(draggedTaskIndex, 1);
                    tasks.splice(targetTaskIndex, 0, draggedTask);
                    renderGanttChart();
                }
            }
        });

        ganttChartArea.appendChild(ganttGrid);
        drawDependencies();
    }

    function drawDependencies() {
        tasks.forEach(task => {
            task.dependencies.forEach(depId => {
                const depTask = tasks.find(t => t.id === depId);
                if (depTask) {
                    const from = document.querySelector(`[data-task-id="${depTask.id}"]`);
                    const to = document.querySelector(`[data-task-id="${task.id}"]`);
                    if (from && to) {
                        const line = document.createElement('div');
                        line.className = 'dependency-line';

                        const fromRect = from.getBoundingClientRect();
                        const toRect = to.getBoundingClientRect();
                        const containerRect = ganttChartArea.getBoundingClientRect();

                        line.style.left = `${from.offsetLeft + from.offsetWidth}px`;
                        line.style.top = `${from.offsetTop + from.offsetHeight / 2}px`;
                        line.style.width = `${to.offsetLeft - (from.offsetLeft + from.offsetWidth)}px`;

                        ganttChartArea.appendChild(line);
                    }
                }
            });
        });
    }

    saveBtn.addEventListener('click', () => {
        localStorage.setItem('gantt-tasks', JSON.stringify(tasks));
    });

    loadBtn.addEventListener('click', () => {
        tasks = JSON.parse(localStorage.getItem('gantt-tasks')) || [];
        nextTaskId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
        renderGanttChart();
    });

    shareBtn.addEventListener('click', () => {
        const data = encodeURIComponent(JSON.stringify(tasks));
        const url = `${window.location.href.split('?')[0]}?data=${data}`;
        navigator.clipboard.writeText(url);
        alert('Shareable link copied to clipboard!');
    });

    exportPdfBtn.addEventListener('click', () => {
        html2canvas(ganttChartArea).then(canvas => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            doc.save('gantt-chart.pdf');
        });
    });

    exportPngBtn.addEventListener('click', () => {
        html2canvas(ganttChartArea).then(canvas => {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'gantt-chart.png';
            link.click();
        });
    });

    exportCsvBtn.addEventListener('click', () => {
        let csvContent = 'data:text/csv;charset=utf-8,Task Name,Description,Start Date,End Date,Progress,Dependencies\n';
        tasks.forEach(task => {
            csvContent += `${task.name},${task.description},${task.start},${task.end},${task.progress},"${task.dependencies.join(',')}"\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'gantt-chart.csv');
        document.body.appendChild(link);
        link.click();
    });

    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');
    if (data) {
        tasks = JSON.parse(decodeURIComponent(data));
        renderGanttChart();
    }
});
