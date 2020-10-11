import os
import random
MAX_CARDS = 750

whiteCards = []
for deckDir in os.listdir('src/'):
    with open('src/' + deckDir + '/white.md.txt') as f:
        cards = [x.strip() for x in f.readlines() if ',' not in x and len(x) <= 20 and '/' not in x and "*" not in x and "™" not in x and "®" not in x and "#" not in x]
        whiteCards.extend(cards)

uniqueWhite = list(set(whiteCards))
random.shuffle(uniqueWhite)
uniqueWhite = uniqueWhite[0:MAX_CARDS]

with open('drawasaurus.txt', 'w') as lb:
    lb.write("\n".join(uniqueWhite))
print(",".join(uniqueWhite))