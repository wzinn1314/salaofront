# Lirio com globo luminoso em Python

Execute: `python py/flor.py`

Lirio branco com seis petalas, garganta e estames dourados, caule e folhas verdes. Cinco aureolas douradas claras giram em planos diferentes, formando um globo ao redor da flor. Os arcos passam pela frente e por tras conforme a profundidade. Um morrinho verde denso, com laminas curvas de grama, substitui os brilhos do chao. O lirio nasce pequeno de dentro da grama, cresce e abre as petalas; permanece aberto antes de reiniciar o ciclo.

Geometria procedural em NumPy, desenhada com Pillow/Tkinter. Nao le nem reproduz video. Sao 156.024 pontos: 89.424 nas petalas, 4.800 no caule, 6.400 nas folhas, 2.400 nos estames, 48.000 no morrinho de grama e 5.000 no globo. Os quadros sao calculados em uma thread separada para manter a interface responsiva.

Espaco pausa; R reinicia; F11 alterna tela cheia; Esc fecha.

Dependencias: `python -m pip install -r py/requirements.txt`

Previa: `python py/flor.py --preview outputs/lirio-globo.png --time 7`

Medicao: `python py/flor.py --benchmark 60`
Os estames ficam ocultos com a flor abaixada e aparecem gradualmente durante a subida. As orbitas sao pontilhadas, giram e aumentam junto com a abertura, inspiradas no video de referencia.


Jardim Thalita: a cena agora mostra um morro de grama ampliado com varios lirios formando o nome thalita. Todos crescem e desabrocham juntos. Previa: `python py/flor.py --preview outputs/thalita-jardim.png --time 7`.
