/** Exact R02 glove center, with no cuff/normal buffer upload during physics substeps. */
export function updateGloveCentersOnly(actor){
  for(const g of actor.gloves){const w=actor.latest.posedMatrices[g.index],k=actor.latest.posedMatrices[g.knuckle];if(!w||!k)throw Error('Glove anatomical endpoints missing');
    g.position.set(w[3]+(k[3]-w[3])*.75,w[11]+(k[11]-w[11])*.75,-w[7]+(-k[7]+w[7])*.75);
  }
}
