const socket = io();

 const startForm = document.getElementById('startForm');
  const nameInput = document.getElementById('nameInput');
  const greeting = document.getElementById('greeting');
  startForm.addEventListener('submit', e => {
    e.preventDefault();
    const nameValue = nameInput.value.trim();
   
    if (!nameValue) {
      nameInput.focus();
      return;
    }

   socket.emit("userInfo",{name:nameValue})

  });

  socket.on("joined",{data})



