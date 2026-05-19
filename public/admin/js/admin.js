document.addEventListener('DOMContentLoaded', () => {
    const deleteForms = document.querySelectorAll('form[action*="/delete"]');
    deleteForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            if (!confirm('Вы уверены, что хотите удалить?')) e.preventDefault();
        });
    });
});