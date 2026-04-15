// 五子棋AI引擎模块
// 负责搜索算法、评估函数、启发式优化

if (typeof window.GomokuAI === 'undefined') {
    window.GomokuAI = class GomokuAI {
    constructor(difficulty = 'normal') {
        this.difficulty = difficulty;
        this.config = GomokuConfig.getDifficulty(difficulty);
        this.nodesSearched = 0;
        this.transpositionTable = new Map();
        this.killerMoves = new Array(20).fill(null).map(() => ({ row: -1, col: -1 }));
        this.historyHeuristic = new Map();
        this.lineCache = new Map();
        
        this.SCORE = GomokuConfig.SCORE;
        this.SEARCH_CONFIG = GomokuConfig.SEARCH_CONFIG;
        this.TRANSPOSITION_CONFIG = GomokuConfig.TRANSPOSITION_CONFIG;
        this.PATTERN_CONFIG = GomokuConfig.PATTERN_CONFIG;
        
        this.patternScoreTable = this.initPatternScoreTable();
    }
    
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        this.config = GomokuConfig.getDifficulty(difficulty);
        this.clearCaches();
    }
    
    clearCaches() {
        this.transpositionTable.clear();
        this.lineCache.clear();
        this.historyHeuristic.clear();
        this.killerMoves.fill({ row: -1, col: -1 });
        this.nodesSearched = 0;
    }
    
    initPatternScoreTable() {
        const table = new Array(this.PATTERN_CONFIG.PATTERN_TABLE_SIZE).fill(0);
        for (let i = 0; i < this.PATTERN_CONFIG.PATTERN_TABLE_SIZE; i++) {
            table[i] = this.calculatePatternScore(i);
        }
        return table;
    }
    
    checkOpponentHasWinningMove(board, player) {
        const opponent = player === 1 ? 2 : 1;
        const candidates = this.getAllNeighborCells(board);
        
        for (const { row, col } of candidates) {
            if (board[row][col] === 0) {
                board[row][col] = opponent;
                if (this.checkWin(board, row, col, opponent)) {
                    board[row][col] = 0;
                    return { row, col };
                }
                board[row][col] = 0;
            }
        }
        return null;
    }
    
    findWinningThreat(board, player) {
        const candidates = this.getAllNeighborCells(board);
        let bestThreat = null;
        let bestScore = 0;
        
        for (const { row, col } of candidates) {
            if (board[row][col] === 0) {
                board[row][col] = player;
                const score = this.quickEvaluateThreat(board, row, col, player);
                if (score >= this.SCORE.FOUR) {
                    if (score > bestScore) {
                        bestScore = score;
                        bestThreat = { row, col, score };
                    }
                }
                board[row][col] = 0;
            }
        }
        
        return bestThreat;
    }
    
    findBlockingMove(board, player) {
        const opponent = player === 1 ? 2 : 1;
        const candidates = this.getAllNeighborCells(board);
        let bestBlock = null;
        let bestBlockScore = 0;
        
        for (const { row, col } of candidates) {
            if (board[row][col] === 0) {
                board[row][col] = opponent;
                const score = this.quickEvaluateThreat(board, row, col, opponent);
                if (score >= this.SCORE.OPEN_FOUR) {
                    if (score > bestBlockScore) {
                        bestBlockScore = score;
                        bestBlock = { row, col, score };
                    }
                }
                board[row][col] = 0;
            }
        }
        
        return bestBlock;
    }
    
    quickEvaluateThreat(board, row, col, player) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        let maxScore = 0;
        
        for (const [dr, dc] of directions) {
            let count = 1;
            let openEnds = 0;
            
            for (let i = 1; i <= 4; i++) {
                const r = row + dr * i, c = col + dc * i;
                if (r >= 0 && r < board.length && c >= 0 && c < board.length) {
                    if (board[r][c] === player) count++;
                    else if (board[r][c] === 0) { openEnds++; break; }
                    else break;
                }
            }
            
            for (let i = 1; i <= 4; i++) {
                const r = row - dr * i, c = col - dc * i;
                if (r >= 0 && r < board.length && c >= 0 && c < board.length) {
                    if (board[r][c] === player) count++;
                    else if (board[r][c] === 0) { openEnds++; break; }
                    else break;
                }
            }
            
            if (count >= 5) return this.SCORE.FIVE;
            if (count === 4 && openEnds >= 1) return this.SCORE.OPEN_FOUR;
            if (count === 4) return this.SCORE.FOUR;
            if (count === 3 && openEnds >= 2) return this.SCORE.OPEN_THREE;
            if (count === 3 && openEnds >= 1) return Math.max(maxScore, this.SCORE.SLEEP_THREE);
        }
        
        return maxScore;
    }
    
    getAllNeighborCells(board) {
        const candidates = new Set();
        const size = board.length;
        const skill = this.config.skill;
        const actualRange = skill === 1 ? 2 : (skill === 2 ? 3 : 4);
        
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== 0) {
                    for (let dr = -actualRange; dr <= actualRange; dr++) {
                        for (let dc = -actualRange; dc <= actualRange; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === 0) {
                                candidates.add(`${nr},${nc}`);
                            }
                        }
                    }
                }
            }
        }
        
        return Array.from(candidates).map(key => {
            const [r, c] = key.split(',').map(Number);
            return { row: r, col: c };
        });
    }
    
    getCenterDistance(row, col, boardSize) {
        const center = (boardSize - 1) / 2;
        const dx = col - center;
        const dy = row - center;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getMoveThreatLevel(board, row, col, player) {
        const opponent = player === 1 ? 2 : 1;
        let maxThreat = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        
        board[row][col] = player;
        if (this.checkWin(board, row, col, player)) {
            board[row][col] = 0;
            return this.SCORE.FIVE * 10;
        }
        
        for (const [dr, dc] of directions) {
            let count = 1;
            let openEnds = 0;
            
            for (let i = 1; i <= 4; i++) {
                const r = row + dr * i, c = col + dc * i;
                if (r >= 0 && r < board.length && c >= 0 && c < board.length) {
                    if (board[r][c] === player) count++;
                    else if (board[r][c] === 0) { openEnds++; break; }
                    else break;
                }
            }
            
            for (let i = 1; i <= 4; i++) {
                const r = row - dr * i, c = col - dc * i;
                if (r >= 0 && r < board.length && c >= 0 && c < board.length) {
                    if (board[r][c] === player) count++;
                    else if (board[r][c] === 0) { openEnds++; break; }
                    else break;
                }
            }
            
            if (count >= 5) maxThreat = Math.max(maxThreat, this.SCORE.FIVE);
            else if (count === 4 && openEnds >= 1) maxThreat = Math.max(maxThreat, this.SCORE.OPEN_FOUR);
            else if (count === 4) maxThreat = Math.max(maxThreat, this.SCORE.FOUR);
            else if (count === 3 && openEnds >= 2) maxThreat = Math.max(maxThreat, this.SCORE.OPEN_THREE);
            else if (count === 3 && openEnds >= 1) maxThreat = Math.max(maxThreat, this.SCORE.SLEEP_THREE);
            else if (count === 2 && openEnds >= 2) maxThreat = Math.max(maxThreat, this.SCORE.OPEN_TWO);
        }
        
        board[row][col] = opponent;
        if (this.checkWin(board, row, col, opponent)) {
            board[row][col] = 0;
            return this.SCORE.FIVE * 5;
        }
        
        for (const [dr, dc] of directions) {
            let count = 1;
            let openEnds = 0;
            
            for (let i = 1; i <= 4; i++) {
                const r = row + dr * i, c = col + dc * i;
                if (r >= 0 && r < board.length && c >= 0 && c < board.length) {
                    if (board[r][c] === opponent) count++;
                    else if (board[r][c] === 0) { openEnds++; break; }
                    else break;
                }
            }
            
            for (let i = 1; i <= 4; i++) {
                const r = row - dr * i, c = col - dc * i;
                if (r >= 0 && r < board.length && c >= 0 && c < board.length) {
                    if (board[r][c] === opponent) count++;
                    else if (board[r][c] === 0) { openEnds++; break; }
                    else break;
                }
            }
            
            if (count >= 5) maxThreat = Math.max(maxThreat, this.SCORE.FIVE * 5);
            else if (count === 4 && openEnds >= 1) maxThreat = Math.max(maxThreat, this.SCORE.OPEN_FOUR * 2);
            else if (count === 4) maxThreat = Math.max(maxThreat, this.SCORE.FOUR * 2);
            else if (count === 3 && openEnds >= 2) maxThreat = Math.max(maxThreat, this.SCORE.OPEN_THREE * 1.5);
        }
        
        board[row][col] = 0;
        return maxThreat;
    }
    
    calculatePatternScore(pattern) {
        let str = '';
        for (let j = 0; j < this.PATTERN_CONFIG.LINE_LENGTH; j++) {
            const bit = (pattern >> (this.PATTERN_CONFIG.LINE_LENGTH - 1 - j)) & 1;
            str += bit ? '1' : '0';
        }
        
        if (str.includes('11111')) return this.SCORE.FIVE;
        if (str.includes('011110')) return this.SCORE.OPEN_FOUR;
        
        const fourPatterns = ['11110', '01111', '10111', '11011', '11101'];
        if (fourPatterns.some(p => str.includes(p))) return this.SCORE.FOUR;
        
        if (str.includes('01110')) return this.SCORE.OPEN_THREE;
        
        const threePatterns = ['11100', '00111', '11010', '01011', '10110', '01101', '11001', '10011', '10101'];
        if (threePatterns.some(p => str.includes(p))) return this.SCORE.SLEEP_THREE;
        
        if (str.includes('0110')) return this.SCORE.OPEN_TWO;
        
        const twoPatterns = ['1100', '0011', '1010', '0101', '1001'];
        if (twoPatterns.some(p => str.includes(p))) return this.SCORE.SLEEP_TWO;
        
        if (str.includes('1')) return this.SCORE.ONE;
        
        return this.SCORE.ZERO;
    }
    
    getLine(board, row, col, dr, dc) {
        const cacheKey = `${row},${col},${dr},${dc},${board.length}`;
        
        if (this.lineCache.has(cacheKey)) {
            return this.lineCache.get(cacheKey);
        }
        
        let line = '';
        for (let i = -4; i <= 4; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r >= 0 && r < board.length && c >= 0 && c < board.length) {
                line += board[r][c] === 0 ? '0' : (board[r][c] === 1 ? '1' : '2');
            }
        }
        
        this.lineCache.set(cacheKey, line);
        return line;
    }
    
    analyzePattern(line, player) {
        const target = player === 1 ? '1' : '2';
        if (line.includes(target.repeat(5))) return this.SCORE.FIVE;
        
        let pattern = 0;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === target) {
                pattern |= (1 << (this.PATTERN_CONFIG.LINE_LENGTH - 1 - i));
            } else if (char !== '0') {
                pattern |= (1 << (this.PATTERN_CONFIG.LINE_LENGTH - 1 - i));
            }
        }
        
        return this.patternScoreTable[pattern] || this.SCORE.ZERO;
    }
    
    evaluatePoint(board, row, col, player) {
        if (board[row][col] !== 0) return -Infinity;
        
        const opponent = player === 1 ? 2 : 1;
        let attackScore = 0;
        let defendScore = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        
        const originalValue = board[row][col];
        
        board[row][col] = player;
        if (this.checkWin(board, row, col, player)) {
            board[row][col] = originalValue;
            return this.SCORE.FIVE * this.SEARCH_CONFIG.THREAT_SCORES.IMMEDIATE_WIN;
        }
        
        for (const [dr, dc] of directions) {
            const line = this.getLine(board, row, col, dr, dc);
            attackScore += this.analyzePattern(line, player);
        }
        
        board[row][col] = opponent;
        if (this.checkWin(board, row, col, opponent)) {
            board[row][col] = originalValue;
            return this.SCORE.FIVE * this.SEARCH_CONFIG.THREAT_SCORES.BLOCK_THREAT;
        }
        
        for (const [dr, dc] of directions) {
            const line = this.getLine(board, row, col, dr, dc);
            defendScore += this.analyzePattern(line, opponent);
        }
        
        board[row][col] = originalValue;
        
        const attackMultiplier = this.getAttackMultiplier();
        const defenseMultiplier = this.getDefenseMultiplier();
        const centerDistance = this.getCenterDistance(row, col, board.length);
        const centerPenalty = centerDistance * this.SEARCH_CONFIG.CENTER_DISTANCE_PENALTY * 10;
        
        return attackScore * attackMultiplier + defendScore * defenseMultiplier - centerPenalty;
    }
    
    evaluateBoard(board, player) {
        const opponent = player === 1 ? 2 : 1;
        let playerScore = 0;
        let opponentScore = 0;
        const size = board.length;
        
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === player) {
                    playerScore += this.evaluatePoint(board, r, c, player);
                } else if (board[r][c] === opponent) {
                    opponentScore += this.evaluatePoint(board, r, c, opponent);
                }
            }
        }
        
        const attackMultiplier = this.getAttackMultiplier();
        const defenseMultiplier = this.getDefenseMultiplier();
        
        return playerScore * attackMultiplier - opponentScore * defenseMultiplier;
    }
    
    getDefenseMultiplier() {
        if (this.config.skill === 1) return this.SEARCH_CONFIG.DEFENSE_MULTIPLIERS.EASY;
        if (this.config.skill === 2) return this.SEARCH_CONFIG.DEFENSE_MULTIPLIERS.NORMAL;
        return this.SEARCH_CONFIG.DEFENSE_MULTIPLIERS.HARD;
    }
    
    getAttackMultiplier() {
        if (this.config.skill === 1) return this.SEARCH_CONFIG.ATTACK_MULTIPLIERS.EASY;
        if (this.config.skill === 2) return this.SEARCH_CONFIG.ATTACK_MULTIPLIERS.NORMAL;
        return this.SEARCH_CONFIG.ATTACK_MULTIPLIERS.HARD;
    }
    
    checkWin(board, row, col, player) {
        const directions = [
            [[0, 1], [0, -1]],
            [[1, 0], [-1, 0]],
            [[1, 1], [-1, -1]],
            [[1, -1], [-1, 1]]
        ];
        
        for (const [dir1, dir2] of directions) {
            let count = 1;
            let r = row + dir1[0], c = col + dir1[1];
            
            while (r >= 0 && r < board.length && c >= 0 && c < board.length && 
                   board[r][c] === player) {
                count++;
                r += dir1[0];
                c += dir1[1];
            }
            
            r = row + dir2[0];
            c = col + dir2[1];
            while (r >= 0 && r < board.length && c >= 0 && c < board.length && 
                   board[r][c] === player) {
                count++;
                r += dir2[0];
                c += dir2[1];
            }
            
            if (count >= 5) return true;
        }
        
        return false;
    }
    
    generateBoardHash(board, player, depth) {
        let hash = depth * this.TRANSPOSITION_CONFIG.HASH_PRIME + player;
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board.length; c++) {
                hash = (hash * this.TRANSPOSITION_CONFIG.HASH_PRIME + board[r][c]) & 0x7FFFFFFF;
            }
        }
        return hash % this.TRANSPOSITION_CONFIG.TABLE_SIZE;
    }
    
    orderMoves(board, moves, player, depth) {
        const scoredMoves = moves.map(move => {
            let killerBonus = 0;
            if (this.config.useKillerHeuristic) {
                for (let i = 0; i < Math.min(depth, this.killerMoves.length); i++) {
                    if (this.killerMoves[i].row === move.row && this.killerMoves[i].col === move.col) {
                        killerBonus = 10000 * (depth - i);
                        break;
                    }
                }
            }
            
            let historyBonus = 0;
            if (this.config.useHistoryHeuristic) {
                const key = `${move.row},${move.col},${player}`;
                historyBonus = this.historyHeuristic.get(key) || 0;
            }
            
            const evalScore = this.evaluatePoint(board, move.row, move.col, player);
            return {
                move,
                score: evalScore + killerBonus + historyBonus
            };
        });
        
        return scoredMoves.sort((a, b) => b.score - a.score);
    }
    
    updateHistoryHeuristic(move, player, depth) {
        if (!this.config.useHistoryHeuristic) return;
        
        const key = `${move.row},${move.col},${player}`;
        const currentScore = this.historyHeuristic.get(key) || 0;
        this.historyHeuristic.set(key, currentScore + depth * depth * 10);
    }
    
    updateKillerMoves(move, depth) {
        if (!this.config.useKillerHeuristic) return;
        
        const index = Math.min(depth, this.killerMoves.length - 1);
        this.killerMoves[index] = { row: move.row, col: move.col };
    }
    
    minimax(board, depth, alpha, beta, isMaximizing, player, maxDepth, startTime) {
        this.nodesSearched++;
        
        if (Date.now() - startTime > this.config.timeLimit) {
            return this.evaluateBoard(board, player);
        }
        
        const hash = this.generateBoardHash(board, player, depth);
        const cached = this.transpositionTable.get(hash);
        if (cached && cached.depth >= depth) {
            if (cached.flag === this.TRANSPOSITION_CONFIG.FLAGS.EXACT) return cached.score;
            if (cached.flag === this.TRANSPOSITION_CONFIG.FLAGS.LOWER && cached.score >= beta) return cached.score;
            if (cached.flag === this.TRANSPOSITION_CONFIG.FLAGS.UPPER && cached.score <= alpha) return cached.score;
        }
        
        const candidateConfig = this.getCandidateConfig();
        const moves = this.getCandidateMoves(board, candidateConfig.searchCandidates);
        if (moves.length === 0) return this.evaluateBoard(board, player);
        
        if (depth === 0) {
            return this.evaluateBoard(board, player);
        }
        
        const ordered = this.orderMoves(board, moves, player, depth);
        
        let bestScore = isMaximizing ? -Infinity : Infinity;
        let bestMove = null;
        let flag = this.TRANSPOSITION_CONFIG.FLAGS.EXACT;
        
        for (const { move } of ordered) {
            board[move.row][move.col] = player;
            
            if (this.checkWin(board, move.row, move.col, player)) {
                board[move.row][move.col] = 0;
                const winScore = isMaximizing ? 
                    this.SCORE.FIVE * 10 : 
                    -this.SCORE.FIVE * 10;
                
                this.transpositionTable.set(hash, {
                    score: winScore,
                    depth,
                    flag: this.TRANSPOSITION_CONFIG.FLAGS.EXACT,
                    move
                });
                
                return winScore;
            }
            
            const score = this.minimax(
                board, depth - 1, alpha, beta, !isMaximizing, 
                player === 1 ? 2 : 1, maxDepth, startTime
            );
            
            board[move.row][move.col] = 0;
            
            if (isMaximizing) {
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                    this.updateHistoryHeuristic(move, player, depth);
                    this.updateKillerMoves(move, depth);
                }
                if (bestScore > alpha) alpha = bestScore;
                if (alpha >= beta) {
                    flag = this.TRANSPOSITION_CONFIG.FLAGS.LOWER;
                    break;
                }
            } else {
                if (score < bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                if (bestScore < beta) beta = bestScore;
                if (beta <= alpha) {
                    flag = this.TRANSPOSITION_CONFIG.FLAGS.UPPER;
                    break;
                }
            }
        }
        
        this.transpositionTable.set(hash, {
            score: bestScore,
            depth,
            flag,
            move: bestMove
        });
        
        return bestScore;
    }
    
    getCandidateConfig() {
        if (this.config.skill === 1) return this.SEARCH_CONFIG.CANDIDATE_LIMITS.EASY;
        if (this.config.skill === 2) return this.SEARCH_CONFIG.CANDIDATE_LIMITS.NORMAL;
        return this.SEARCH_CONFIG.CANDIDATE_LIMITS.HARD;
    }
    
    iterativeDeepening(board, player) {
        const startTime = Date.now();
        let bestMove = null;
        let bestScore = -Infinity;
        let currentDepth = 2;
        
        const emptyCount = this.countEmptyCells(board);
        if (emptyCount >= board.length * board.length - 1) {
            return this.getOpeningMove(board);
        }
        
        const ownWin = this.findWinningThreat(board, player);
        if (ownWin && ownWin.score >= this.SCORE.FIVE * 0.9) {
            return ownWin;
        }
        
        const opponentWin = this.checkOpponentHasWinningMove(board, player);
        if (opponentWin) {
            return opponentWin;
        }
        
        const attackThreat = this.findWinningThreat(board, player);
        if (attackThreat) {
            return attackThreat;
        }
        
        const blockThreat = this.findBlockingMove(board, player);
        if (blockThreat) {
            return blockThreat;
        }
        
        const candidateConfig = this.SEARCH_CONFIG.CANDIDATE_LIMITS.HARD;
        const candidates = this.getCandidateMoves(board, candidateConfig.maxCandidates);
        const scored = candidates.map(m => ({
            move: m,
            score: this.evaluatePoint(board, m.row, m.col, player),
            threatLevel: this.getMoveThreatLevel(board, m.row, m.col, player)
        }));
        scored.sort((a, b) => b.score - a.score);
        
        const winMove = scored.find(s => s.score >= this.SCORE.FIVE * 0.9);
        if (winMove) return winMove.move;
        
        const topMoves = scored.slice(0, Math.min(8, scored.length));
        
        if (topMoves[0] && topMoves[0].threatLevel >= this.SCORE.OPEN_FOUR) {
            return topMoves[0].move;
        }
        
        if (topMoves[0] && topMoves[0].score >= this.SCORE.OPEN_THREE * 2) {
            const hasBetterMove = topMoves.some((m, i) => i > 0 && m.score > topMoves[0].score * 1.5);
            if (!hasBetterMove) {
                return topMoves[0].move;
            }
        }
        
        while (Date.now() - startTime < this.config.timeLimit * 0.8 && 
               currentDepth <= this.config.depth) {
            
            let currentBestMove = topMoves[0] ? topMoves[0].move : { row: Math.floor(board.length / 2), col: Math.floor(board.length / 2) };
            let currentBestScore = -Infinity;
            
            for (const { move } of topMoves) {
                if (Date.now() - startTime > this.config.timeLimit) break;
                
                const boardCopy = this.cloneBoard(board);
                boardCopy[move.row][move.col] = player;
                
                if (this.checkWin(boardCopy, move.row, move.col, player)) {
                    return move;
                }
                
                const score = this.minimax(
                    boardCopy, currentDepth - 1, -Infinity, Infinity, 
                    false, player === 1 ? 2 : 1, currentDepth, startTime
                );
                
                if (score > currentBestScore) {
                    currentBestScore = score;
                    currentBestMove = move;
                }
            }
            
            bestMove = currentBestMove;
            bestScore = currentBestScore;
            currentDepth++;
        }
        
        return bestMove || (topMoves[0] ? topMoves[0].move : { row: Math.floor(board.length / 2), col: Math.floor(board.length / 2) });
    }
    
    useMinimaxSearch(board, player) {
        const startTime = Date.now();
        
        const emptyCount = this.countEmptyCells(board);
        if (emptyCount >= board.length * board.length - 1) {
            return this.getOpeningMove(board);
        }
        
        const ownWin = this.findWinningThreat(board, player);
        if (ownWin && ownWin.score >= this.SCORE.FIVE * 0.9) {
            return ownWin;
        }
        
        const opponentWin = this.checkOpponentHasWinningMove(board, player);
        if (opponentWin) {
            return opponentWin;
        }
        
        const attackThreat = this.findWinningThreat(board, player);
        if (attackThreat) {
            return attackThreat;
        }
        
        const blockThreat = this.findBlockingMove(board, player);
        if (blockThreat) {
            return blockThreat;
        }
        
        const candidateConfig = this.getCandidateConfig();
        const candidates = this.getCandidateMoves(board, candidateConfig.maxCandidates);
        const scored = candidates.map(m => ({
            move: m,
            score: this.evaluatePoint(board, m.row, m.col, player),
            threatLevel: this.getMoveThreatLevel(board, m.row, m.col, player)
        }));
        scored.sort((a, b) => b.score - a.score);
        
        const winMove = scored.find(s => s.score >= this.SCORE.FIVE * 0.9);
        if (winMove) return winMove.move;
        
        const topMoves = scored.slice(0, Math.min(8, scored.length));
        
        if (topMoves[0] && topMoves[0].threatLevel >= this.SCORE.OPEN_FOUR) {
            return topMoves[0].move;
        }
        
        if (topMoves[0] && topMoves[0].score >= this.SCORE.OPEN_THREE * 2) {
            const hasBetterMove = topMoves.some((m, i) => i > 0 && m.score > topMoves[0].score * 1.5);
            if (!hasBetterMove) {
                return topMoves[0].move;
            }
        }
        
        let bestMove = topMoves[0] ? topMoves[0].move : { row: Math.floor(board.length / 2), col: Math.floor(board.length / 2) };
        let bestScore = -Infinity;
        const depth = this.config.depth;
        
        for (const { move } of topMoves) {
            if (Date.now() - startTime > this.config.timeLimit) break;
            
            const boardCopy = this.cloneBoard(board);
            boardCopy[move.row][move.col] = player;
            
            if (this.checkWin(boardCopy, move.row, move.col, player)) {
                return move;
            }
            
            const score = this.minimax(
                boardCopy, depth - 1, -Infinity, Infinity, 
                false, player === 1 ? 2 : 1, depth, startTime
            );
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }
    
    getOpeningMove(board) {
        const center = Math.floor(board.length / 2);
        const offsets = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, -1], [-1, 1], [1, -1]];
        for (const [dr, dc] of offsets) {
            const r = center + dr, c = center + dc;
            if (r >= 0 && r < board.length && c >= 0 && c < board.length && board[r][c] === 0) {
                return { row: r, col: c };
            }
        }
        return { row: center, col: center };
    }
    
    getCandidateMoves(board, maxCount) {
        const candidates = new Set();
        const size = board.length;
        const searchRange = this.config.skill >= 2 ? 3 : 2;
        
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== 0) {
                    for (let dr = -searchRange; dr <= searchRange; dr++) {
                        for (let dc = -searchRange; dc <= searchRange; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < size && nc >= 0 && nc < size && 
                                board[nr][nc] === 0) {
                                candidates.add(`${nr},${nc}`);
                            }
                        }
                    }
                }
            }
        }
        
        if (candidates.size === 0) {
            const center = Math.floor(size / 2);
            return [{ row: center, col: center }];
        }
        
        const moves = Array.from(candidates).map(key => {
            const [r, c] = key.split(',').map(Number);
            return { row: r, col: c };
        });
        
        return moves.slice(0, maxCount);
    }
    
    cloneBoard(board) {
        return board.map(row => [...row]);
    }
    
    countEmptyCells(board) {
        let count = 0;
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board.length; c++) {
                if (board[r][c] === 0) count++;
            }
        }
        return count;
    }
    
    findBestMove(board, player) {
        this.clearCaches();
        
        if (this.config.useIterativeDeepening) {
            return this.iterativeDeepening(board, player);
        }
        
        return this.useMinimaxSearch(board, player);
    }
    
    getSearchStats() {
        return {
            nodesSearched: this.nodesSearched,
            transpositionTableSize: this.transpositionTable.size,
            historyHeuristicSize: this.historyHeuristic.size
        };
    }
}

}
