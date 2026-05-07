// Configuração e Estado Global
const API_URL = 'https://pokeapi.co/api/v2/pokemon';
let offset = 0; // Resetado para 0 para a primeira geração
const limit = 20;


// Estado da Aplicação
let isFavoritesView = false;
let currentSearch = '';
let favorites = JSON.parse(localStorage.getItem('pokedex_favorites')) || [];

// Referências do DOM
const pokemonContainer = document.getElementById('pokemon-container');
const statusMessage = document.getElementById('status-message');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageInfo = document.getElementById('page-info');
const searchInput = document.getElementById('search-input');
const favoritesToggleBtn = document.getElementById('favorites-toggle-btn');
const modal = document.getElementById('pokemon-modal');
const modalDetails = document.getElementById('modal-details');
const closeModal = document.querySelector('.close-modal');

/**
 * Inicializa a aplicação
 */
async function init() {
    setupEventListeners();
    loadPokemons();
}

/**
 * Configura os ouvintes de eventos do DOM
 */
function setupEventListeners() {
    // Paginação
    prevBtn.addEventListener('click', () => {
        if (offset >= limit) {
            offset -= limit;
            loadPokemons();
            window.scrollTo(0, 0);
        }
    });

    nextBtn.addEventListener('click', () => {
        offset += limit;
        loadPokemons();
        window.scrollTo(0, 0);
    });

    // Busca com debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.toLowerCase().trim();
            isFavoritesView = false;
            favoritesToggleBtn.textContent = 'Ver Favoritos';
            offset = 0;
            
            if (currentSearch === '') {
                loadPokemons();
            } else {
                searchPokemon(currentSearch);
            }
        }, 500);
    });

    // Filtro de Favoritos
    favoritesToggleBtn.addEventListener('click', () => {
        isFavoritesView = !isFavoritesView;
        favoritesToggleBtn.textContent = isFavoritesView ? 'Ver Todos' : 'Ver Favoritos';
        searchInput.value = '';
        offset = 0;
        loadPokemons();
    });

    // Fechar Modal
    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

/**
 * Carrega Pokémon baseado no estado atual (Lista normal ou Favoritos)
 */
async function loadPokemons() {
    showStatus('Carregando...', 'info');
    pokemonContainer.innerHTML = '';
    
    try {
        if (isFavoritesView) {
            await loadFavorites();
        } else {
            await loadNormalList();
        }
    } catch (error) {
        console.error(error);
        showStatus('Erro ao buscar dados do servidor.', 'error');
    }
}

/**
 * Carrega a lista normal paginada
 */
async function loadNormalList() {
    const response = await fetch(`${API_URL}?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Erro na lista');
    
    const data = await response.json();
    const pokemonDetailsPromises = data.results.map(pokemon => fetchPokemonData(pokemon.url));
    const pokemonList = await Promise.all(pokemonDetailsPromises);
    
    renderCards(pokemonList);
    updatePaginationUI(data.count);
    hideStatus();
}

/**
 * Carrega apenas os Pokémon favoritados
 */
async function loadFavorites() {
    if (favorites.length === 0) {
        showStatus('Você ainda não possui favoritos.', 'info');
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
        pageInfo.textContent = '';
        return;
    }

    const favoritePromises = favorites.map(id => fetchPokemonData(`${API_URL}/${id}`));
    const favoriteList = await Promise.all(favoritePromises);
    
    renderCards(favoriteList);
    
    // Esconde paginação na vista de favoritos (ou simplifica)
    // prevBtn.classList.add('hidden');
    // nextBtn.classList.add('hidden');
    // pageInfo.textContent = `${favorites.length} favorito(s) encontrado(s)`;
    // hideStatus();
}

/**
 * Busca um Pokémon específico pelo nome ou número (ID)
 */
async function searchPokemon(query) {
    showStatus(`Buscando por "${query}"...`, 'info');
    pokemonContainer.innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}/${query}`);
        if (!response.ok) {
            if (response.status === 404) {
                showStatus('Nenhum Pokémon encontrado com esse nome ou número.', 'info');
            } else {
                throw new Error('Erro na busca');
            }
            return;
        }
        
        const pokemon = await response.json();
        renderCards([pokemon]);
        
        // Esconde paginação durante a busca individual
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
        pageInfo.textContent = `Resultado da busca: #${pokemon.id}`;
        hideStatus();
    } catch (error) {
        console.error(error);
        showStatus('Erro ao realizar busca.', 'error');
    }
}

/**
 * Busca dados detalhados
 */
async function fetchPokemonData(urlOrPath) {
    const response = await fetch(urlOrPath);
    return await response.json();
}

/**
 * Renderiza os cards
 */
function renderCards(pokemons) {
    pokemonContainer.innerHTML = '';
    pokemons.forEach(pokemon => {
        const card = createPokemonCard(pokemon);
        pokemonContainer.appendChild(card);
    });
}

/**
 * Cria o card DOM
 */
function createPokemonCard(pokemon) {
    const card = document.createElement('div');
    card.classList.add('pokemon-card');
    
    const isFav = favorites.includes(pokemon.id);
    const imageUrl = pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default;
    const types = pokemon.types.map(t => `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`).join(' ');

    card.innerHTML = `
        <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${pokemon.id}">★</button>
        <p class="pokemon-id">#${pokemon.id.toString().padStart(3, '0')}</p>
        <img src="${imageUrl}" alt="${pokemon.name}">
        <h3>${pokemon.name}</h3>
        <div class="types-container">${types}</div>
    `;

    // Eventos do Card
    card.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(pokemon.id, e.target);
    });

    card.addEventListener('click', () => showDetails(pokemon));

    return card;
}

/**
 * Alterna o estado de favorito
 */
function toggleFavorite(id, btn) {
    const index = favorites.indexOf(id);
    if (index === -1) {
        favorites.push(id);
        btn.classList.add('active');
    } else {
        favorites.splice(index, 1);
        btn.classList.remove('active');
        if (isFavoritesView) loadPokemons(); // Remove do grid se estiver na vista de favoritos
    }
    localStorage.setItem('pokedex_favorites', JSON.stringify(favorites));
}

/**
 * Exibe o modal de detalhes
 */
function showDetails(pokemon) {
    const imageUrl = pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default;
    const types = pokemon.types.map(t => `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`).join(' ');
    
    modalDetails.innerHTML = `
        <img src="${imageUrl}" alt="${pokemon.name}" style="width: 200px; margin-bottom: 2rem;">
        <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">${pokemon.name.toUpperCase()}</h2>
        <p class="pokemon-id" style="font-size: 1.1rem; margin-bottom: 1.5rem;">#${pokemon.id.toString().padStart(3, '0')}</p>
        <div class="types-container" style="margin-bottom: 2rem;">${types}</div>
        <div class="stats-grid" style="display: flex; justify-content: center; gap: 3rem; border-top: 1px solid #e2e8f0; pt-2rem; margin-top: 1rem; padding-top: 2rem;">
            <div>
                <p style="color: var(--text-muted); font-size: 0.875rem; font-weight: 600; text-transform: uppercase;">Altura</p>
                <p style="font-size: 1.25rem; font-weight: 700;">${(pokemon.height / 10).toFixed(1)}m</p>
            </div>
            <div>
                <p style="color: var(--text-muted); font-size: 0.875rem; font-weight: 600; text-transform: uppercase;">Peso</p>
                <p style="font-size: 1.25rem; font-weight: 700;">${(pokemon.weight / 10).toFixed(1)}kg</p>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

/**
 * Atualiza UI da paginação
 */
function updatePaginationUI(totalCount) {
    prevBtn.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
    prevBtn.disabled = offset === 0;
    nextBtn.disabled = offset + limit >= totalCount;
    
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-${type}`;
    statusMessage.classList.remove('hidden');
}

function hideStatus() {
    statusMessage.classList.add('hidden');
}

init();
