export interface PlayerRank {
  title: string;
  encouragement: string;
}

export function getPlayerRank(score: number): PlayerRank {
  if (score >= 80) {
    return {
      title: '切瓜传说',
      encouragement: '这手速可以出道了！'
    };
  }

  if (score >= 60) {
    return {
      title: 'Combo 达人',
      encouragement: '太会切了，Combo 感满满！'
    };
  }

  if (score >= 40) {
    return {
      title: '西瓜高手',
      encouragement: '很强！你的刀光已经很稳了！'
    };
  }

  if (score >= 20) {
    return {
      title: '水果小忍者',
      encouragement: '不错喔，已经抓到节奏了！'
    };
  }

  return {
    title: '新手切瓜员',
    encouragement: '手感刚开始热起来，再来一局！'
  };
}
