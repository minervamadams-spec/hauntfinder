// Google Forms behind the community-spotted flow. Both are NEW forms with their own
// response sheets ("Nominations", "Claim or remove"); the three existing sheets are
// untouched. Fill in the formResponse URL and the entry.NNN id of each question.
// While `action` is empty the pages say nominations are not open and send nothing.
// Forms: "Hauntfinder Nominations" (edit id 1tg9nA-_vI7MrlsOmQaqI8azJbttqOeXGNUmtlBEiHq8) and
// "Hauntfinder Claim or remove" (edit id 1CUZMv6CrI_H08TThtXD2fuZbtnmuu_q6A5FbKnfMBoU), both in the site owner's Google Drive.
window.HF_NOMINATIONS = {
  nominate: {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLScO7JrKO6WRZnPN-n5AdhrKzZFrxty3Oz2R7OsgIqtGQR7klA/formResponse',
    entries: {
      street: 'entry.1998831263', town: 'entry.355835948', lat: 'entry.1121985632', lng: 'entry.740880817', photo: 'entry.1102620759',
      why: 'entry.81094822', best: 'entry.1414534240', litUntil: 'entry.1667636371', nickname: 'entry.1044283742', email: 'entry.114177723'
    }
  },
  claim: {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSe_UeGyiyJ_PDkBQ2XZeFsFVe0y83BE5TX4Fe-8jcK3EgGBpw/formResponse',
    entries: { address: 'entry.1967646810', listing: 'entry.102002082', request: 'entry.801695209', email: 'entry.1397044519' }
  },
  photoApi: '/api/upload'
};
