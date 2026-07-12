import QRCode from 'qrcode';

export const generateQRCode = async (data) => {
  try {
    return await QRCode.toDataURL(data, { width: 256, margin: 2 });
  } catch {
    return null;
  }
};

export const generateAssetTag = async (prisma) => {
  const lastAsset = await prisma.asset.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { assetTag: true },
  });

  let nextNum = 1;
  if (lastAsset?.assetTag) {
    const match = lastAsset.assetTag.match(/AF-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  return `AF-${String(nextNum).padStart(4, '0')}`;
};
