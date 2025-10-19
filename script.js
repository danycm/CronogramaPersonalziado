document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const themeSwitcher = document.getElementById('theme-switcher');
    const taskForm = document.getElementById('task-form');
    const ganttChart = document.getElementById('gantt-chart');

    // App State
    let tasks = [];
    let nextTaskId = 1;
    let viewMode = 'running_days'; // 'running_days' or 'work_days'
    let projectStartDate = new Date();
    let showCriticalPath = true;

    // Theme Switcher
    themeSwitcher.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
    });

    // Task Form Submission
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = document.getElementById('task-id').value;
        const taskData = {
            name: document.getElementById('task-name').value,
            description: document.getElementById('task-description').value,
            duration: parseInt(document.getElementById('task-duration').value),
            durationUnit: document.getElementById('task-duration-unit').value,
            dependencies: document.getElementById('task-dependencies').value.split(',').map(d => d.trim()).filter(Boolean),
            progress: parseInt(document.getElementById('task-progress').value),
            deadline: document.getElementById('task-deadline').value || null
        };

        if (taskId) {
            const task = tasks.find(t => t.id === parseInt(taskId));
            Object.assign(task, taskData);
        } else {
            taskData.id = nextTaskId++;
            tasks.push(taskData);
        }

        taskForm.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('form-submit-button').textContent = 'Adicionar Tarefa';
        renderGanttChart();
    });

    function renderGanttChart() {
        const calculatedTasks = calculateTaskPositions(tasks);

        if (calculatedTasks === null) {
            ganttChart.innerHTML = '<div class="error-message">Erro: Dependência circular detectada. Por favor, corrija as dependências para renderizar o gráfico.</div>';
            return;
        }

        ganttChart.innerHTML = '';

        if (calculatedTasks.length === 0) return;

        const totalDuration = Math.max(0, ...calculatedTasks.map(t => t.end || 0));
        const pixelsPerDay = 50; // Or some other scale factor
        const chartAreaPadding = 40; // Space for delete buttons etc.

        // Set chart width to enable horizontal scrolling
        const totalWidth = totalDuration * pixelsPerDay + chartAreaPadding * 2;
        ganttChart.style.width = `${totalWidth}px`;

        // Create timeline headers
        for (let i = 0; i <= totalDuration; i++) {
            const headerCell = document.createElement('div');
            headerCell.className = 'gantt-timeline-header';
            headerCell.textContent = `Dia ${i}`;
            headerCell.style.left = `${i * pixelsPerDay + chartAreaPadding}px`; // Apply padding
            ganttChart.appendChild(headerCell);
        }

        calculatedTasks.forEach((task, index) => {
            const taskElement = document.createElement('div');
            taskElement.className = 'gantt-task-row';
            taskElement.dataset.taskId = task.id;
            taskElement.style.top = `${index * 40 + 40}px`; // 40px height per task, plus header
            taskElement.draggable = true;

            const taskBar = document.createElement('div');
            taskBar.className = 'gantt-bar';
            if (task.isCritical && showCriticalPath) {
                taskBar.classList.add('critical-path');
            }
            if (task.deadline && task.endDate && new Date(task.endDate) > new Date(task.deadline)) {
                taskBar.classList.add('task-delayed');
            }
            taskBar.style.left = `${task.start * pixelsPerDay + chartAreaPadding}px`; // Apply padding
            taskBar.style.width = `${task.duration * pixelsPerDay}px`;
            taskBar.dataset.taskId = task.id;

            taskBar.innerHTML = `
                <div class="gantt-bar-content">
                    <div class="gantt-bar-name">${task.name}</div>
                    <div class="gantt-bar-description">${task.description}</div>
                </div>
                <div class="gantt-bar-progress" style="width: ${task.progress}%"></div>
                <div class="gantt-resizer resizer-left"></div>
                <div class="gantt-resizer resizer-right"></div>
            `;

            taskBar.addEventListener('click', () => {
                document.getElementById('task-id').value = task.id;
                document.getElementById('task-name').value = task.name;
                document.getElementById('task-description').value = task.description;
                document.getElementById('task-duration').value = task.duration;
                document.getElementById('task-duration-unit').value = task.durationUnit;
                document.getElementById('task-dependencies').value = task.dependencies.join(', ');
                document.getElementById('task-progress').value = task.progress;
                document.getElementById('task-deadline').value = task.deadline ? task.deadline.split('T')[0] : '';
                document.getElementById('form-submit-button').textContent = 'Atualizar Tarefa';
            });

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'X';
            deleteButton.className = 'delete-task';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                tasks = tasks.filter(t => t.id !== task.id);
                renderGanttChart();
            });

            taskElement.appendChild(deleteButton);
            taskElement.appendChild(taskBar);
            ganttChart.appendChild(taskElement);
        });

        drawDependencyLines(calculatedTasks);
    }

    function drawDependencyLines(calculatedTasks) {
        const svgNamespace = "http://www.w3.org/2000/svg";
        let svg = document.getElementById('dependency-svg');
        if (!svg) {
            svg = document.createElementNS(svgNamespace, "svg");
            svg.id = 'dependency-svg';
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            ganttChart.appendChild(svg);
        }
        svg.innerHTML = '';

        calculatedTasks.forEach(task => {
            task.dependencies.forEach(depString => {
                const depId = parseInt(depString.match(/(\d+)/)[1]);
                const predecessor = calculatedTasks.find(t => t.id === depId);
                if (!predecessor) return;

                const fromElement = ganttChart.querySelector(`.gantt-bar[data-task-id="${predecessor.id}"]`);
                const toElement = ganttChart.querySelector(`.gantt-bar[data-task-id="${task.id}"]`);

                if (fromElement && toElement) {
                    const line = document.createElementNS(svgNamespace, 'path');
                    const depType = depString.match(/[A-Z]{2}/) ? depString.match(/[A-Z]{2}/)[0] : 'FS';

                    let x1, y1, x2, y2;

                    y1 = fromElement.offsetTop + fromElement.offsetHeight / 2;
                    y2 = toElement.offsetTop + toElement.offsetHeight / 2;

                    if (depType === 'FS') {
                        x1 = fromElement.offsetLeft + fromElement.offsetWidth;
                        x2 = toElement.offsetLeft;
                    } else if (depType === 'SS') {
                        x1 = fromElement.offsetLeft;
                        x2 = toElement.offsetLeft;
                    } else if (depType === 'FF') {
                        x1 = fromElement.offsetLeft + fromElement.offsetWidth;
                        x2 = toElement.offsetLeft + toElement.offsetWidth;
                    }

                    const path = `M ${x1} ${y1} C ${x1 + 50} ${y1} ${x2 - 50} ${y2} ${x2} ${y2}`;

                    line.setAttribute('d', path);
                    line.setAttribute('stroke', 'var(--text-secondary)');
                    line.setAttribute('stroke-width', '2');
                    line.setAttribute('fill', 'none');
                    line.setAttribute('marker-end', 'url(#arrow)');
                    svg.appendChild(line);
                }
            });
        });

        // Define arrowhead marker
        const defs = document.createElementNS(svgNamespace, 'defs');
        const marker = document.createElementNS(svgNamespace, 'marker');
        marker.id = 'arrow';
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS(svgNamespace, 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', 'var(--text-secondary)');
        marker.appendChild(path);
        defs.appendChild(marker);
        svg.appendChild(defs);
    }

    // Vertical Drag and Drop for reordering
    let draggedTaskId = null;

    ganttChart.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('gantt-task-row')) {
            draggedTaskId = parseInt(e.target.dataset.taskId);
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    ganttChart.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetRow = e.target.closest('.gantt-task-row');
        if (targetRow) {
            targetRow.style.background = 'rgba(0,0,0,0.1)'; // Visual feedback
        }
    });

    ganttChart.addEventListener('dragleave', (e) => {
        const targetRow = e.target.closest('.gantt-task-row');
        if (targetRow) {
            targetRow.style.background = '';
        }
    });

    ganttChart.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetRow = e.target.closest('.gantt-task-row');
        if (targetRow) {
            targetRow.style.background = '';
            const targetTaskId = parseInt(targetRow.dataset.taskId);

            const draggedIndex = tasks.findIndex(t => t.id === draggedTaskId);
            const targetIndex = tasks.findIndex(t => t.id === targetTaskId);

            if (draggedIndex !== -1 && targetIndex !== -1) {
                const [draggedItem] = tasks.splice(draggedIndex, 1);
                tasks.splice(targetIndex, 0, draggedItem);
                renderGanttChart();
            }
        }
        draggedTaskId = null;
    });

    // Horizontal Drag and Drop for moving/resizing
    let isDragging = false;
    let isResizing = false;
    let dragStartX = 0;
    let originalTaskStart = 0;
    let originalTaskWidth = 0;
    let currentTaskElement = null;
    let currentTask = null;
    let resizeHandle = '';
    const pixelsPerDay = 50;

    ganttChart.addEventListener('mousedown', (e) => {
        const target = e.target;

        // Prevent horizontal drag from interfering with vertical drag
        if (target.classList.contains('gantt-task-row')) {
            return;
        }

        if (target.classList.contains('gantt-resizer')) {
            isResizing = true;
            resizeHandle = target.classList.contains('resizer-left') ? 'left' : 'right';
        } else if (target.closest('.gantt-bar')) {
            isDragging = true;
        } else {
            return;
        }

        e.preventDefault();

        currentTaskElement = target.closest('.gantt-bar');
        const taskId = parseInt(currentTaskElement.dataset.taskId);
        currentTask = tasks.find(t => t.id === taskId);

        dragStartX = e.clientX;
        originalTaskStart = currentTaskElement.offsetLeft;
        originalTaskWidth = currentTaskElement.offsetWidth;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });

    function handleMouseMove(e) {
        if (!currentTaskElement) return;

        const deltaX = e.clientX - dragStartX;

        if (isDragging) {
            currentTaskElement.style.left = `${originalTaskStart + deltaX}px`;
        } else if (isResizing) {
            if (resizeHandle === 'right') {
                currentTaskElement.style.width = `${originalTaskWidth + deltaX}px`;
            } else {
                currentTaskElement.style.left = `${originalTaskStart + deltaX}px`;
                currentTaskElement.style.width = `${originalTaskWidth - deltaX}px`;
            }
        }
    }

    function handleMouseUp(e) {
        if (!currentTask) return;

        const deltaX = e.clientX - dragStartX;
        const deltaDays = Math.round(deltaX / pixelsPerDay);

        if (isDragging) {
            if (!currentTask.startOffset) currentTask.startOffset = 0;
            currentTask.startOffset += deltaDays;
        } else if (isResizing) {
            if (resizeHandle === 'right') {
                currentTask.duration += deltaDays;
            } else {
                if (!currentTask.startOffset) currentTask.startOffset = 0;
                currentTask.startOffset += deltaDays;
                currentTask.duration -= deltaDays;
            }
        }

        // Ensure duration is not negative
        if (currentTask.duration < 1) currentTask.duration = 1;

        isDragging = false;
        isResizing = false;
        currentTaskElement = null;
        currentTask = null;

        renderGanttChart();

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    function calculateTaskPositions(tasksToCalculate) {
        if (hasCircularDependency(tasksToCalculate)) {
            return null;
        }

        let calculatedTasks = JSON.parse(JSON.stringify(tasksToCalculate));

        function getTask(id) {
            return calculatedTasks.find(t => t.id === id);
        }

        function daysBetween(date1, date2) {
            return Math.round((new Date(date2) - new Date(date1)) / (1000 * 60 * 60 * 24));
        }

        function addDays(date, days) {
            const newDate = new Date(date);
            newDate.setDate(newDate.getDate() + days);
            return newDate;
        }

        function subtractDays(date, days) {
            const newDate = new Date(date);
            newDate.setDate(newDate.getDate() - days);
            return newDate;
        }

        const addDuration = viewMode === 'work_days' ? addWorkDays : addDays;
        const subtractDuration = viewMode === 'work_days' ? (date, days) => addWorkDays(date, -days) : subtractDays;

        // Initialize tasks without dependencies
        calculatedTasks.forEach(task => {
            if (!task.dependencies || task.dependencies.length === 0) {
                let startDate = projectStartDate;
                if (task.startOffset) {
                    startDate = addDays(startDate, task.startOffset);
                }
                task.startDate = startDate;
                task.endDate = addDuration(task.startDate, task.duration);
            }
        });

        let changed = true;
        while (changed) {
            changed = false;
            calculatedTasks.forEach(task => {
                if (task.startDate) return;

                let dependenciesMet = true;
                let startBasedOnStartDeps = null;
                let startBasedOnFinishDeps = null;

                task.dependencies.forEach(depString => {
                    const match = depString.match(/(\d+)(FS|SS|FF)?/);
                    if (!match) { dependenciesMet = false; return; }

                    const depId = parseInt(match[1]);
                    const depType = match[2] || 'FS';
                    const predecessor = getTask(depId);

                    if (!predecessor || !predecessor.startDate) { dependenciesMet = false; return; }

                    if (depType === 'FS' || depType === 'SS') {
                        const candidateDate = (depType === 'FS') ? new Date(predecessor.endDate) : new Date(predecessor.startDate);
                        if (!startBasedOnStartDeps || candidateDate > startBasedOnStartDeps) {
                            startBasedOnStartDeps = candidateDate;
                        }
                    } else if (depType === 'FF') {
                        const candidateEndDate = new Date(predecessor.endDate);
                        const candidateStartDate = subtractDuration(candidateEndDate, task.duration);
                        if (!startBasedOnFinishDeps || candidateStartDate > startBasedOnFinishDeps) {
                            startBasedOnFinishDeps = candidateStartDate;
                        }
                    }
                });

                if (dependenciesMet) {
                    let finalStartDate = startBasedOnStartDeps || projectStartDate;
                    if (startBasedOnFinishDeps && startBasedOnFinishDeps > finalStartDate) {
                        finalStartDate = startBasedOnFinishDeps;
                    }

                    if (task.startOffset) {
                        finalStartDate = addDays(finalStartDate, task.startOffset);
                    }

                    task.startDate = finalStartDate;
                    task.endDate = addDuration(task.startDate, task.duration);
                    changed = true;
                }
            });
        }

        // Convert dates to day indices for rendering
        calculatedTasks.forEach(task => {
            if (task.startDate) {
                task.start = daysBetween(projectStartDate, task.startDate);
                task.end = daysBetween(projectStartDate, task.endDate);
                task.duration = task.end - task.start;
            }
        });

        // Critical Path Calculation
        const validTasks = calculatedTasks.filter(t => t.endDate);
        if (validTasks.length === 0) return calculatedTasks;

        const maxEndDate = new Date(Math.max.apply(null, validTasks.map(t => new Date(t.endDate))));
        let criticalPath = [];
        let lastTask = validTasks.find(t => new Date(t.endDate).getTime() === maxEndDate.getTime());

        while (lastTask) {
            criticalPath.unshift(lastTask.id);
            let predecessor = null;
            let maxEnd = new Date(0);

            lastTask.dependencies.forEach(depString => {
                const depId = parseInt(depString.match(/(\d+)/)[1]);
                const p = getTask(depId);
                if (p && p.endDate > maxEnd) {
                    maxEnd = p.endDate;
                    predecessor = p;
                }
            });
            lastTask = predecessor;
        }

        calculatedTasks.forEach(task => {
            task.isCritical = criticalPath.includes(task.id);
        });

        return calculatedTasks;
    }

    // Save, Load, Share, Export
    document.getElementById('save-chart').addEventListener('click', () => {
        localStorage.setItem('gantt-tasks', JSON.stringify(tasks));
    });

    document.getElementById('load-chart').addEventListener('click', () => {
        tasks = JSON.parse(localStorage.getItem('gantt-tasks')) || [];
        nextTaskId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
        renderGanttChart();
    });

    document.getElementById('share-chart').addEventListener('click', () => {
        const data = encodeURIComponent(JSON.stringify(tasks));
        const url = `${window.location.href.split('?')[0]}?data=${data}`;
        navigator.clipboard.writeText(url);
        alert('Link compartilhável copiado para a área de transferência!');
    });

    document.getElementById('export-png').addEventListener('click', () => {
        const chartArea = document.querySelector('.gantt-chart-area');
        const originalWidth = ganttChart.style.width;
        const originalOverflow = chartArea.style.overflow;

        chartArea.style.overflow = 'visible';

        html2canvas(ganttChart).then(canvas => {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'gantt-chart.png';
            link.click();

            // Restore styles
            chartArea.style.overflow = originalOverflow;
        });
    });

    document.getElementById('export-pdf').addEventListener('click', () => {
        const chartArea = document.querySelector('.gantt-chart-area');
        const originalOverflow = chartArea.style.overflow;

        chartArea.style.overflow = 'visible';

        html2canvas(ganttChart, {
            width: ganttChart.scrollWidth,
            height: ganttChart.scrollHeight
        }).then(canvas => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            doc.save('gantt-chart.pdf');

            // Restore styles
            chartArea.style.overflow = originalOverflow;
        });
    });

    document.getElementById('export-csv').addEventListener('click', () => {
        let csvContent = 'data:text/csv;charset=utf-8,ID,Nome,Descrição,Duração,Unidade,Dependências,Progresso\n';
        tasks.forEach(task => {
            csvContent += `${task.id},"${task.name}","${task.description}",${task.duration},${task.durationUnit},"${task.dependencies.join(' ')}",${task.progress}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'gantt-chart.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Load from URL
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');
    if (data) {
        tasks = JSON.parse(decodeURIComponent(data));
        renderGanttChart();
    }

    // View Mode Switcher
    document.getElementById('view-mode').addEventListener('change', (e) => {
        viewMode = e.target.value;
        renderGanttChart();
    });

    // Critical Path Toggle
    document.getElementById('toggle-critical-path').addEventListener('click', () => {
        showCriticalPath = !showCriticalPath;
        renderGanttChart();
    });

    // Helper function for work days
    function addWorkDays(startDate, days) {
        let currentDate = new Date(startDate);
        let addedDays = 0;
        if (currentDate.getDay() === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
        } else if (currentDate.getDay() === 6) {
            currentDate.setDate(currentDate.getDate() + 2);
        }
        while (addedDays < days) {
            currentDate.setDate(currentDate.getDate() + 1);
            if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                addedDays++;
            }
        }
        return currentDate;
    }

    function hasCircularDependency(tasks) {
        // Build the graph where edge A -> B means B depends on A.
        const adj = new Map(tasks.map(task => [task.id, []]));
        tasks.forEach(task => { // task is the successor
            if (task.dependencies) {
                task.dependencies.forEach(depString => {
                    const depId = parseInt(depString.match(/(\d+/)[1]); // depId is the predecessor
                    if (adj.has(depId)) {
                        adj.get(depId).push(task.id); // Add edge from predecessor to successor
                    }
                });
            }
        });

        const visited = new Set();
        const recursionStack = new Set();

        function detectCycleUtil(taskId) {
            visited.add(taskId);
            recursionStack.add(taskId);

            const neighbors = adj.get(taskId) || [];
            for (const neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                    if (detectCycleUtil(neighborId)) {
                        return true;
                    }
                } else if (recursionStack.has(neighborId)) {
                    // Found a back edge to a node in the current recursion stack
                    return true;
                }
            }

            recursionStack.delete(taskId);
            return false;
        }

        for (const task of tasks) {
            if (!visited.has(task.id)) {
                if (detectCycleUtil(task.id)) {
                    return true;
                }
            }
        }

        return false;
    }
});