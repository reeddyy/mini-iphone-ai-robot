import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function load() {const window={};vm.runInNewContext(readFileSync(new URL('../public/mini-board.js',import.meta.url),'utf8'),{window});return window.MiniBoard;}
test('Rules detect all winning lines and a full-board draw',()=>{
  const board=load();
  for(const mark of ['X','O'])for(const cells of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) {
    const squares=Array(9).fill(null);for(const i of cells)squares[i]=mark;
    const outcome=board.result(squares);
    assert.equal(outcome.winner,mark);assert.equal(JSON.stringify(outcome.line),JSON.stringify(cells));
  }
  assert.equal(board.result(['X','O','X','X','O','O','O','X','X']).winner,'draw');
});
test('Moves cannot overwrite a square, skip a turn, mutate old state, or continue a finished round',()=>{
  const board=load(),start=board.create();
  for(const index of [-1,9,1.5,'1',null])assert.equal(board.place(start,index,'X'),start);
  assert.equal(board.place(start,0,'O'),start);
  const next=board.place(start,0,'X');
  assert.equal(start.board[0],null);assert.equal(next.board[0],'X');
  assert.equal(board.place(next,1,'X'),next);
  assert.equal(board.place(next,0,'O'),next);
  const finished={board:['X','X','X','O','O',null,null,null,null],turn:null,winner:'X',line:[0,1,2]};
  assert.equal(board.place(finished,8,'O'),finished);assert.equal(board.miniMove(finished),finished);
});
test('Mini takes a win or blocks a single immediate threat',()=>{
  const board=load();
  const game={...board.create(),turn:'O',board:['O','O',null,'X','X',null,null,null,'X']};
  assert.equal(board.chooseMove(game),2);
  const block={...board.create(),turn:'O',board:['X','X',null,null,'O',null,null,null,null]};
  assert.equal(board.chooseMove(block),2);
});
test('Every reachable human move produces at most one legal Mini move and a valid result',()=>{
  const board=load();let rounds=0,humanWins=0;
  function visit(game) {
    if(game.winner){rounds++;if(game.winner==='X')humanWins++;return;}
    for(let i=0;i<9;i++)if(game.board[i]===null) {
      const human=board.place(game,i,'X');
      const mini=board.miniMove(human);
      const changed=mini.board.filter((mark,index)=>mark!==human.board[index]).length;
      assert.equal(changed,human.winner?0:1);
      assert.equal(mini.board.filter(mark=>mark==='X').length,mini.board.filter(mark=>mark==='O').length+(mini.winner==='X'?1:mini.winner==='draw'?1:0));
      assert.equal(board.result(mini.board).winner,mini.winner);
      visit(mini);
    }
  }
  visit(board.create());assert.ok(rounds>100);assert.ok(humanWins>0,'the friendly opponent can be beaten');
});
test('Bilingual spoken positions map to one square and ambiguous or negated moves are refused',()=>{
  const board=load();
  for(const [text,index] of [['top left',0],['Put X in top-left please',0],['top center',1],['upper right',2],['middle left',3],['center',4],['middle right',5],['bottom left',6],['lower middle',7],['bottom right',8],['number nine',8],['five',4],['3',2],['row two column three',5],['第一行第三列',2],['左上角',0],['上面中间',1],['正中间',4],['右边中间',5],['左下',6],['第八个格子',7]])assert.equal(board.parsePosition(text),index,text);
  for(const text of ['top left or bottom right','not top left','不要中间','I have two cats','one more story','number ten','middle left or center',null])assert.equal(board.parsePosition(text),null,String(text));
});
test('Game requests include a common spoken spelling and names in Mandarin',()=>{
  const board=load();
  for(const text of ['let us play tic tac toe','play tic tik toe','tic-tac-toe','noughts and crosses','我们玩井字棋吧'])assert.equal(board.wantsGame(text),true,text);
  assert.equal(board.wantsGame('tell me a story'),false);
  assert.match(board.checkpoint(board.create()),/browser alone places both marks/);
});
